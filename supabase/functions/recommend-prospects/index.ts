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
    const { prospects, targetVertical, disqualifiedCompanies } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    const verticalInstruction = targetVertical
      ? `\n\nIMPORTANT: Focus your recommendations specifically on the "${targetVertical}" product vertical. All recommended companies should be relevant to ${targetVertical}.`
      : '';

    const exclusionInstruction = disqualifiedCompanies?.length
      ? `\n\nDo NOT recommend any of the following companies — they have been explicitly disqualified: ${disqualifiedCompanies.join(", ")}.`
      : '';

    const userPrompt = `Here are our current prospects:

${JSON.stringify(prospectSummary, null, 2)}

Based on this prospect list, recommend 5-8 NEW companies or types of companies we should pursue.${verticalInstruction}${exclusionInstruction} For each recommendation, provide:
1. Company name (real companies if you know them, or descriptive type)
2. Why they're a good fit
3. Suggested approach for initial contact
4. Estimated product vertical (Water Coolers, Ice Machines, Beverage Dispensers, Water Filtration, Spas & Hot Tubs, Fountains, Industrial, Residential, Commercial)
5. Business model (OEM, Distributor, or eCommerce)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_prospects",
              description: "Return structured prospect recommendations",
              parameters: {
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
                          enum: ["Water Coolers", "Ice Machines", "Beverage Dispensers", "Water Filtration", "Spas & Hot Tubs", "Fountains", "Industrial", "Residential", "Commercial"]
                        },
                        companyType: { 
                          type: "string", 
                          enum: ["OEM", "Distributor", "eCommerce"]
                        },
                        website: { type: "string", description: "Company website if known" },
                        linkedIn: { type: "string", description: "LinkedIn URL if known" },
                      },
                      required: ["companyName", "reason", "approach", "marketType", "companyType"],
                      additionalProperties: false,
                    },
                  },
                  insights: {
                    type: "string",
                    description: "Overall insights about the prospect list and market opportunities",
                  },
                },
                required: ["recommendations", "insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_prospects" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
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
