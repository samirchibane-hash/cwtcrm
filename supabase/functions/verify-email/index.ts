import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyEmailRequest {
  firstName: string;
  lastName: string;
  domain: string;
}

interface EmailVariation {
  email: string;
  status: 'pending' | 'checking' | 'valid' | 'invalid' | 'unknown';
  result?: any;
}

function generateEmailVariations(firstName: string, lastName: string, domain: string): string[] {
  const fn = firstName.toLowerCase().trim();
  const ln = lastName.toLowerCase().trim();
  const fi = fn.charAt(0);
  const li = ln.charAt(0);
  
  return [
    `${fn}@${domain}`,           // jane@proaqua.com
    `${ln}@${domain}`,           // doe@proaqua.com
    `${fn}.${ln}@${domain}`,     // jane.doe@proaqua.com
    `${fi}.${ln}@${domain}`,     // j.doe@proaqua.com
    `${fn}.${li}@${domain}`,     // jane.d@proaqua.com
    `${fn}${ln}@${domain}`,      // janedoe@proaqua.com
    `${fi}${ln}@${domain}`,      // jdoe@proaqua.com
    `${fn}${li}@${domain}`,      // janed@proaqua.com
    `${fi}${li}@${domain}`,      // jd@proaqua.com
    `${ln}.${fn}@${domain}`,     // doe.jane@proaqua.com
    `${ln}${fn}@${domain}`,      // doejane@proaqua.com
    `${fi}_${ln}@${domain}`,     // j_doe@proaqua.com
    `${fn}_${ln}@${domain}`,     // jane_doe@proaqua.com
  ];
}

async function verifySingleEmail(email: string, apiKey: string): Promise<{ status: string; result: any }> {
  try {
    const response = await fetch(`https://api.clearout.io/v2/email_verify/instant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer:${apiKey}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Clearout API error for ${email}:`, response.status, errorText);
      return { status: 'error', result: { error: errorText, statusCode: response.status } };
    }

    const result = await response.json();
    console.log(`Clearout result for ${email}:`, result);
    
    // Clearout returns status like 'valid', 'invalid', 'unknown', etc.
    const status = result.data?.status || result.status || 'unknown';
    
    return { status, result };
  } catch (error) {
    console.error(`Error verifying ${email}:`, error);
    return { status: 'error', result: { error: String(error) } };
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const CLEAROUT_API_KEY = Deno.env.get("CLEAROUT_API_KEY");
    if (!CLEAROUT_API_KEY) {
      throw new Error("CLEAROUT_API_KEY is not configured");
    }

    const { firstName, lastName, domain }: VerifyEmailRequest = await req.json();

    if (!firstName || !lastName || !domain) {
      throw new Error("Missing required fields: firstName, lastName, domain");
    }

    // Clean the domain (remove @ if present)
    const cleanDomain = domain.replace('@', '').trim();
    
    // Generate all email variations
    const variations = generateEmailVariations(firstName, lastName, cleanDomain);
    
    console.log(`Checking ${variations.length} email variations for ${firstName} ${lastName} @${cleanDomain}`);
    
    const results: EmailVariation[] = [];
    let validEmail: string | null = null;

    // Check each variation until we find a valid one
    for (const email of variations) {
      console.log(`Verifying: ${email}`);
      const { status, result } = await verifySingleEmail(email, CLEAROUT_API_KEY);
      
      const variation: EmailVariation = {
        email,
        status: status === 'valid' ? 'valid' : status === 'invalid' ? 'invalid' : 'unknown',
        result,
      };
      
      results.push(variation);
      
      // If we found a valid email, we can stop (but we'll return all checked results)
      if (status === 'valid') {
        validEmail = email;
        console.log(`Found valid email: ${email}`);
        break;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return new Response(
      JSON.stringify({
        success: true,
        validEmail,
        results,
        totalChecked: results.length,
        totalVariations: variations.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in verify-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
