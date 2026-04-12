import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Plus, Loader2, Ban, Trash2,
  RefreshCw, Linkedin, Globe, MapPin, Building2,
} from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import { useProductVerticals } from "@/hooks/useProductVerticals";
import TypeBadge from "./TypeBadge";
import MarketTypeBadge from "./MarketTypeBadge";
import { toast } from "sonner";
import type { CompanyType, MarketType } from "@/data/prospects";

const DISQUALIFIED_KEY = "disqualified_recommendations";
const CACHE_KEY = "ai_recommendations_cache";

interface Recommendation {
  companyName: string;
  reason: string;
  approach: string;
  marketType: MarketType;
  companyType: CompanyType;
  website?: string;
  linkedIn?: string;
  estimatedSize?: string;
  priority?: "High" | "Medium" | "Low";
  geography?: string;
}

interface AIResponse {
  recommendations: Recommendation[];
  insights: string;
}

interface CachedResult {
  data: AIResponse;
  generatedAt: string;
  vertical: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  High: "bg-green-100 text-green-800 border-green-200",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Low: "bg-slate-100 text-slate-700 border-slate-200",
};

export function AIRecommendationsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [selectedVertical, setSelectedVertical] = useState<string>("all");
  const [addedCompanies, setAddedCompanies] = useState<Set<string>>(new Set());
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [disqualified, setDisqualified] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DISQUALIFIED_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const { prospects, addProspect } = useProspects();
  const { allVerticals } = useProductVerticals();

  // Load from cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedResult = JSON.parse(cached);
        setResult(parsed.data);
        setGeneratedAt(parsed.generatedAt);
        setSelectedVertical(parsed.vertical);
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-fetch if nothing is cached and prospects are loaded
  useEffect(() => {
    if (!result && !loading && prospects.length > 0) {
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects.length]);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setAddedCompanies(new Set());

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-prospects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prospects,
            targetVertical: selectedVertical !== "all" ? selectedVertical : undefined,
            disqualifiedCompanies: disqualified.length > 0 ? disqualified : undefined,
            count: 10,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get recommendations");
      }

      const data: AIResponse = await response.json();
      const now = new Date().toISOString();

      setResult(data);
      setGeneratedAt(now);

      // Persist to cache
      const toCache: CachedResult = { data, generatedAt: now, vertical: selectedVertical };
      localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get recommendations");
    } finally {
      setLoading(false);
    }
  }, [prospects, selectedVertical, disqualified]);

  const handleAddProspect = async (rec: Recommendation) => {
    try {
      await addProspect({
        companyName: rec.companyName,
        type: rec.companyType,
        marketType: rec.marketType,
        leadTier: "",
        street: "",
        city: rec.geography || "",
        state: "",
        zip: "",
        stage: "New Lead",
        engagementNotes: `AI Recommended: ${rec.reason}\n\nSuggested approach: ${rec.approach}`,
        linkedIn: rec.linkedIn || "",
        website: rec.website || "",
        contacts: [],
        engagements: [],
        lastContact: "",
      });
      setAddedCompanies(prev => new Set(prev).add(rec.companyName));
      toast.success(`Added ${rec.companyName} to pipeline`);
    } catch {
      toast.error("Failed to add prospect");
    }
  };

  const handleDisqualify = (companyName: string) => {
    const updated = [...disqualified, companyName];
    setDisqualified(updated);
    localStorage.setItem(DISQUALIFIED_KEY, JSON.stringify(updated));
    if (result) {
      const filtered = result.recommendations.filter(r => r.companyName !== companyName);
      const updatedResult = { ...result, recommendations: filtered };
      setResult(updatedResult);
      // Update cache too
      if (generatedAt) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: updatedResult, generatedAt, vertical: selectedVertical }));
      }
    }
    toast.info(`${companyName} excluded from future recommendations`);
  };

  const clearDisqualified = () => {
    setDisqualified([]);
    localStorage.removeItem(DISQUALIFIED_KEY);
    toast.success("Disqualified list cleared");
  };

  const formatGeneratedAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Select value={selectedVertical} onValueChange={setSelectedVertical}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Verticals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verticals</SelectItem>
              {allVerticals.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={fetchRecommendations} disabled={loading} className="gap-2 shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Generating..." : result ? "Refresh" : "Generate"}
          </Button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {generatedAt && (
            <span className="text-xs text-muted-foreground">
              Updated {formatGeneratedAt(generatedAt)}
            </span>
          )}
          {disqualified.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={clearDisqualified}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear {disqualified.length} excluded
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-center">
            Analyzing your {prospects.length} prospects and finding the best new targets...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="rounded-full bg-primary/10 p-5">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-lg">Find your next 10 prospects</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Claude will analyze your existing pipeline and recommend companies that match your
              ideal customer profile — complete with sizing, priority, and outreach guidance.
            </p>
          </div>
          <Button onClick={fetchRecommendations} size="lg" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Recommendations
          </Button>
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <div className="space-y-5">
          {/* Count summary */}
          <p className="text-sm font-medium text-muted-foreground">
            {result.recommendations.length} recommended {result.recommendations.length === 1 ? "company" : "companies"}
            {selectedVertical !== "all" ? ` · ${selectedVertical}` : ""}
          </p>

          {/* Recommendation cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.recommendations.map((rec, idx) => {
              const isAdded = addedCompanies.has(rec.companyName);
              return (
                <Card
                  key={idx}
                  className={`flex flex-col transition-shadow hover:shadow-md ${isAdded ? "opacity-60" : ""}`}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-snug">{rec.companyName}</CardTitle>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <TypeBadge type={rec.companyType} />
                          <MarketTypeBadge marketType={rec.marketType} />
                          {rec.priority && (
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[rec.priority] ?? ""}`}
                            >
                              {rec.priority} priority
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-3 px-4 pb-4">
                    {/* Meta row */}
                    {(rec.estimatedSize || rec.geography) && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {rec.estimatedSize && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {rec.estimatedSize}
                          </span>
                        )}
                        {rec.geography && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {rec.geography}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Why */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                        Why a fit
                      </p>
                      <p className="text-sm leading-snug">{rec.reason}</p>
                    </div>

                    {/* Approach */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                        Outreach approach
                      </p>
                      <p className="text-sm leading-snug text-muted-foreground">{rec.approach}</p>
                    </div>

                    {/* Links */}
                    {(rec.website || rec.linkedIn) && (
                      <div className="flex gap-3 pt-1">
                        {rec.website && (
                          <a
                            href={rec.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Globe className="h-3 w-3" />
                            Website
                          </a>
                        )}
                        {rec.linkedIn && (
                          <a
                            href={rec.linkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Linkedin className="h-3 w-3" />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 mt-auto">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => handleAddProspect(rec)}
                        disabled={isAdded}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isAdded ? "Added to Pipeline" : "Add to Pipeline"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2"
                        title="Exclude from future recommendations"
                        onClick={() => handleDisqualify(rec.companyName)}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
