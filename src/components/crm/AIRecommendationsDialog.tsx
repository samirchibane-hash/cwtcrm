import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, ExternalLink, Loader2, Ban, Trash2 } from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import { useProductVerticals } from "@/hooks/useProductVerticals";
import TypeBadge from "./TypeBadge";
import MarketTypeBadge from "./MarketTypeBadge";
import { toast } from "sonner";
import type { CompanyType, MarketType } from "@/data/prospects";

const DISQUALIFIED_KEY = "disqualified_recommendations";

interface Recommendation {
  companyName: string;
  reason: string;
  approach: string;
  marketType: MarketType;
  companyType: CompanyType;
  website?: string;
  linkedIn?: string;
}

interface AIResponse {
  recommendations: Recommendation[];
  insights: string;
}

export function AIRecommendationsDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [selectedVertical, setSelectedVertical] = useState<string>("all");
  const [addedCompanies, setAddedCompanies] = useState<Set<string>>(new Set());
  const [disqualified, setDisqualified] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DISQUALIFIED_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const { prospects, addProspect } = useProspects();
  const { allVerticals } = useProductVerticals();

  const fetchRecommendations = async () => {
    setLoading(true);
    setResult(null);
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
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get recommendations");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get recommendations");
    } finally {
      setLoading(false);
    }
  };

  const handleAddProspect = async (rec: Recommendation) => {
    try {
      await addProspect({
        companyName: rec.companyName,
        type: rec.companyType,
        marketType: rec.marketType,
        leadTier: '',
        street: '',
        city: '',
        state: "",
        zip: '',
        stage: "New Lead",
        engagementNotes: `AI Recommended: ${rec.reason}\n\nSuggested approach: ${rec.approach}`,
        linkedIn: rec.linkedIn || "",
        website: rec.website || "",
        contacts: [],
        engagements: [],
        lastContact: "",
      });
      setAddedCompanies(prev => new Set(prev).add(rec.companyName));
      toast.success(`Added ${rec.companyName} to prospects`);
    } catch (error) {
      toast.error("Failed to add prospect");
    }
  };

  const handleDisqualify = (companyName: string) => {
    const updated = [...disqualified, companyName];
    setDisqualified(updated);
    localStorage.setItem(DISQUALIFIED_KEY, JSON.stringify(updated));
    if (result) {
      setResult({
        ...result,
        recommendations: result.recommendations.filter(r => r.companyName !== companyName),
      });
    }
    toast.info(`${companyName} won't appear in future recommendations`);
  };

  const clearDisqualified = () => {
    setDisqualified([]);
    localStorage.removeItem(DISQUALIFIED_KEY);
    toast.success("Disqualified list cleared");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Recommendations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Prospect Recommendations
            </DialogTitle>
            {disqualified.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive shrink-0"
                onClick={clearDisqualified}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear {disqualified.length} disqualified
              </Button>
            )}
          </div>
        </DialogHeader>

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <p className="text-muted-foreground text-center max-w-md">
              Our AI will analyze your {prospects.length} existing prospects and recommend new companies 
              that match your target market and customer profile.
            </p>
            <div className="w-full max-w-xs space-y-2">
              <label className="text-sm font-medium text-foreground">Target Product Vertical</label>
              <Select value={selectedVertical} onValueChange={setSelectedVertical}>
                <SelectTrigger>
                  <SelectValue placeholder="All Verticals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verticals</SelectItem>
                  {allVerticals.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchRecommendations} size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Recommendations
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing your prospects and finding matches...</p>
          </div>
        )}

        {result && (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Insights Card */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Market Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{result.insights}</p>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Recommended Companies ({result.recommendations.length})
                </h3>
                {result.recommendations.map((rec, idx) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{rec.companyName}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <TypeBadge type={rec.companyType} />
                            <MarketTypeBadge marketType={rec.marketType} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => handleAddProspect(rec)}
                            disabled={addedCompanies.has(rec.companyName)}
                          >
                            <Plus className="h-3 w-3" />
                            {addedCompanies.has(rec.companyName) ? "Added" : "Add"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Do not recommend this company"
                            onClick={() => handleDisqualify(rec.companyName)}
                          >
                            <Ban className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Why they're a good fit:</p>
                        <p className="text-sm">{rec.reason}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Suggested approach:</p>
                        <p className="text-sm">{rec.approach}</p>
                      </div>
                      {(rec.website || rec.linkedIn) && (
                        <div className="flex gap-2 pt-1">
                          {rec.website && (
                            <a
                              href={rec.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
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
                              <ExternalLink className="h-3 w-3" />
                              LinkedIn
                            </a>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Regenerate Button */}
              <div className="pt-4 flex flex-col items-center gap-3">
                <div className="w-full max-w-xs space-y-2">
                  <label className="text-sm font-medium text-foreground">Target Product Vertical</label>
                  <Select value={selectedVertical} onValueChange={setSelectedVertical}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Verticals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Verticals</SelectItem>
                      {allVerticals.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={fetchRecommendations} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate New Recommendations
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
