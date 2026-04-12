import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospects, targetVertical, disqualifiedCompanies, count = 10 } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    // Build a summary of existing prospects for the AI to analyze
    const prospectSummary = prospects.map((p: any) => ({
      company: p.companyName,
      type: p.type,
      marketType: p.marketType,
      state: p.state,
      notes: p.engagementNotes,
    }));

    const systemPrompt = `You are an expert B2B sales analyst specializing in the water treatment, beverage dispensing, and related equipment industries.

Analyze the provided list of existing prospects and recommend NEW companies that would be good potential customers based on the patterns you observe.

Consider:
- Product verticals (water coolers, ice machines, beverage dispensers, water filtration, spas/hot tubs, fountains, industrial, commercial, residential)
- Business models (OEM manufacturers, Distributors, eCommerce)
- Geographic patterns
- The types of products these companies likely need (UV systems, filtration, etc.)

Provide actionable recommendations with real company names when possible, or describe the type of company to target.`;

    const existingNames = prospects.map((p: any) => p.companyName).filter(Boolean);

    const verticalInstruction = targetVertical
      ? `\n\nIMPORTANT: Focus your recommendations specifically on the "${targetVertical}" product vertical. All recommended companies should be relevant to ${targetVertical}.`
      : '';

    const existingExclusion = existingNames.length
      ? `\n\nDo NOT recommend any company that is the same as or similar in name to our existing prospects. For example, if we have "Oasis" do not recommend "Oasis International" or any other Oasis variant. Existing prospect names to avoid: ${existingNames.join(", ")}.`
      : '';

    const disqualifiedExclusion = disqualifiedCompanies?.length
      ? `\n\nAlso do NOT recommend any of the following explicitly disqualified companies: ${disqualifiedCompanies.join(", ")}.`
      : '';

    const userPrompt = `Here are our current prospects:

${JSON.stringify(prospectSummary, null, 2)}

Based on this prospect list, recommend exactly ${count} NEW companies or types of companies we should pursue.${verticalInstruction}${existingExclusion}${disqualifiedExclusion} For each recommendation, provide:
1. Company name (real companies if you know them, or descriptive type)
2. Why they're a good fit
3. Suggested approach for initial contact
4. Estimated product vertical (Water Coolers, Ice Machines, Beverage Dispensers, Water Filtration, Spas & Hot Tubs, Fountains, Industrial, Residential, Commercial)
5. Business model (OEM, Distributor, or eCommerce)
6. Their website URL (required — look up the real URL if you know the company)
7. Their LinkedIn company page URL (required — use https://www.linkedin.com/company/[slug] format)
8. Estimated company size (Small: <50 employees, Mid-market: 50–500, Enterprise: 500+)
9. Priority level (High, Medium, or Low) based on estimated deal potential and fit
10. Geography (primary US region or state they operate in, e.g. "Southwest US", "Texas", "National")`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "recommend_prospects",
            description: "Return structured prospect recommendations",
            input_schema: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      companyName: { type: "string", description: "Company name or type description" },
                      reason: { type: "string", description: "Why they're a good fit" },
                      approach: { type: "string", description: "Suggested approach for contact" },
                      marketType: {
                        type: "string",
                        enum: ["Water Coolers", "Ice Machines", "Beverage Dispensers", "Water Filtration", "Spas & Hot Tubs", "Fountains", "Industrial", "Residential", "Commercial"],
                      },
                      companyType: {
                        type: "string",
                        enum: ["OEM", "Distributor", "eCommerce"],
                      },
                      website: { type: "string", description: "Company website URL" },
                      linkedIn: { type: "string", description: "LinkedIn company page URL (https://www.linkedin.com/company/[slug])" },
                      estimatedSize: { type: "string", description: "Estimated company size: 'Small (<50 employees)', 'Mid-market (50–500)', or 'Enterprise (500+)'" },
                      priority: { type: "string", enum: ["High", "Medium", "Low"], description: "Priority level based on estimated deal potential and fit" },
                      geography: { type: "string", description: "Primary US region or state they operate in, e.g. 'Southwest US', 'Texas', 'National'" },
                    },
                    required: ["companyName", "reason", "approach", "marketType", "companyType", "website", "linkedIn", "estimatedSize", "priority", "geography"],
                  },
                },
                insights: {
                  type: "string",
                  description: "Overall insights about the prospect list and market opportunities",
                },
              },
              required: ["recommendations", "insights"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "recommend_prospects" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const toolUse = data.content?.find((block: any) => block.type === "tool_use");

    if (!toolUse?.input) {
      throw new Error("Invalid response from AI");
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in recommend-prospects:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
