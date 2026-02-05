import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Plus, ExternalLink, Loader2 } from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import TypeBadge from "./TypeBadge";
import MarketTypeBadge from "./MarketTypeBadge";
import { toast } from "sonner";
import type { CompanyType, MarketType } from "@/data/prospects";

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
  const { prospects, addProspect } = useProspects();

  const fetchRecommendations = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-prospects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prospects }),
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
        state: "",
        stage: "New Lead",
        engagementNotes: `AI Recommended: ${rec.reason}\n\nSuggested approach: ${rec.approach}`,
        linkedIn: rec.linkedIn || "",
        website: rec.website || "",
        contacts: [],
        engagements: [],
        lastContact: "",
      });
      toast.success(`Added ${rec.companyName} to prospects`);
    } catch (error) {
      toast.error("Failed to add prospect");
    }
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
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Prospect Recommendations
          </DialogTitle>
        </DialogHeader>

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground text-center max-w-md">
              Our AI will analyze your {prospects.length} existing prospects and recommend new companies 
              that match your target market and customer profile.
            </p>
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 shrink-0"
                          onClick={() => handleAddProspect(rec)}
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </Button>
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
              <div className="pt-4 flex justify-center">
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
