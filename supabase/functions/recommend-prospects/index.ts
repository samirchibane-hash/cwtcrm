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

    // Build a rich summary of existing prospects for the AI to analyze
    const prospectSummary = prospects.map((p: any) => ({
      company: p.companyName,
      type: p.type,
      marketType: p.marketType,
      state: p.state,
      website: p.website,
      notes: p.engagementNotes,
    }));

    const systemPrompt = `You are a senior B2B sales strategist for Canopus Water Technologies, a manufacturer of UV water disinfection and filtration components sold to OEMs, national distributors, and eCommerce retailers.

Your job is to identify high-value NEW prospects — established, commercially significant companies that manufacture, distribute, or sell water treatment, beverage dispensing, ice, spa/hot tub, or related equipment at scale.

## STRICT QUALITY RULES — every recommendation MUST pass all of these:

1. **No local or regional service businesses.** Do NOT recommend local plumbers, HVAC technicians, water softener service companies, local water dealers, or any company whose primary revenue comes from installation or service contracts rather than product sales.

2. **No small dealers or franchisees.** Do NOT recommend individual franchise locations, small dealerships, or local retail stores. Only recommend the parent brand/manufacturer/national distributor — not their local operators.

3. **Established companies only.** Every recommendation must be a real, named company that is well-known in their industry, has a national or significant regional footprint, and manufactures or distributes products at meaningful scale (typically $10M+ revenue).

4. **Correct business model classification.** Only classify as OEM if the company manufactures finished equipment. Only classify as Distributor if they wholesale to dealers/contractors at scale. Only classify as eCommerce if they sell direct-to-consumer or B2B online at scale.

5. **Directly relevant verticals only.** Focus on companies that sell, manufacture, or distribute products where UV disinfection or inline filtration is a natural component: water coolers, point-of-use/point-of-entry water filtration, ice machines, beverage dispensers, spas & hot tubs, decorative fountains, commercial water systems, industrial process water.

6. **Real URLs required.** Only provide website and LinkedIn URLs you are confident are correct for the specific company named.`;

    const existingNames = prospects.map((p: any) => p.companyName).filter(Boolean);

    const verticalInstruction = targetVertical
      ? `\n\nFocus your recommendations on companies in the **"${targetVertical}"** vertical. All ${count} recommendations must be relevant to ${targetVertical}.`
      : '';

    const existingExclusion = existingNames.length
      ? `\n\nDo NOT recommend any company that is the same as or closely related to our existing prospects. Existing names to avoid (including close variants): ${existingNames.join(", ")}.`
      : '';

    const disqualifiedExclusion = disqualifiedCompanies?.length
      ? `\n\nAlso exclude these explicitly disqualified companies: ${disqualifiedCompanies.join(", ")}.`
      : '';

    const userPrompt = `Here is our current prospect database — analyze the types, verticals, and business models we already target to identify the most valuable gaps:

${JSON.stringify(prospectSummary, null, 2)}

Based on this analysis, recommend exactly ${count} NEW companies we should pursue.${verticalInstruction}${existingExclusion}${disqualifiedExclusion}

Requirements for each recommendation:
1. Real company name — a specific, established, nationally or regionally significant company
2. Why they are a strong fit for UV/filtration components (be specific to their product line)
3. Suggested first outreach approach (role to contact and opening angle)
4. Primary product vertical
5. Business model (OEM, Distributor, or eCommerce)
6. Website URL
7. LinkedIn company page URL
8. Estimated size (Small <50, Mid-market 50–500, Enterprise 500+)
9. Priority (High / Medium / Low) — based on volume potential and strategic fit
10. Geography (their primary US market footprint)`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
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
