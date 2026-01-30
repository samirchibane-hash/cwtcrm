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
  status: 'pending' | 'checking' | 'valid' | 'invalid' | 'unknown' | 'rate_limited' | 'catch_all';
  result?: any;
}

function generateEmailVariations(firstName: string, lastName: string, domain: string): string[] {
  const fn = firstName.toLowerCase().trim();
  const ln = lastName.toLowerCase().trim();
  const fi = fn.charAt(0);
  const li = ln.charAt(0);
  
  return [
    // Put the most common B2B patterns first to reduce API calls (helps avoid rate limits)
    `${fi}${ln}@${domain}`,      // jdoe@proaqua.com
    `${fn}.${ln}@${domain}`,     // jane.doe@proaqua.com
    `${fi}.${ln}@${domain}`,     // j.doe@proaqua.com
    `${fn}${ln}@${domain}`,      // janedoe@proaqua.com

    // Then try simpler/less common variants
    `${fn}@${domain}`,           // jane@proaqua.com
    `${ln}@${domain}`,           // doe@proaqua.com
    `${fn}.${li}@${domain}`,     // jane.d@proaqua.com
    `${fn}${li}@${domain}`,      // janed@proaqua.com
    `${fi}${li}@${domain}`,      // jd@proaqua.com
    `${ln}.${fn}@${domain}`,     // doe.jane@proaqua.com
    `${ln}${fn}@${domain}`,      // doejane@proaqua.com
    `${fi}_${ln}@${domain}`,     // j_doe@proaqua.com
    `${fn}_${ln}@${domain}`,     // jane_doe@proaqua.com
  ];
}

async function verifySingleEmail(email: string, apiKey: string, retryCount = 0): Promise<{ status: string; result: any }> {
  const MAX_RETRIES = 3;
  
  try {
    const response = await fetch(`https://api.clearout.io/v2/email_verify/instant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer:${apiKey}`,
      },
      body: JSON.stringify({ email }),
    });

    if (response.status === 429) {
      const errorText = await response.text();

      // Best-effort parse "try calling after ..." timestamp from Clearout response
      let retryAfterIso: string | null = null;
      try {
        const parsed = JSON.parse(errorText);
        const msg: string | undefined = parsed?.error?.message;
        if (msg) {
          const match = msg.match(/try calling after (.+?)\s+or\s+to increase limit/i);
          if (match?.[1]) {
            const ms = Date.parse(match[1]);
            if (!Number.isNaN(ms)) retryAfterIso = new Date(ms).toISOString();
          }
        }
      } catch {
        // ignore parsing failures
      }

      console.warn(`Rate limited for ${email}, attempt ${Math.min(retryCount + 1, MAX_RETRIES)}/${MAX_RETRIES}`);
      
      if (retryCount < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s, 8s
        const waitTime = Math.pow(2, retryCount + 1) * 1000;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return verifySingleEmail(email, apiKey, retryCount + 1);
      }
      
      console.error(`Rate limit exceeded after ${MAX_RETRIES} retries for ${email}`);
      return { status: 'rate_limited', result: { error: errorText, statusCode: 429, retryAfter: retryAfterIso } };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Clearout API error for ${email}:`, response.status, errorText);
      return { status: 'error', result: { error: errorText, statusCode: response.status } };
    }

    const result = await response.json();
    console.log(`Clearout result for ${email}:`, result);
    
    // Clearout returns status like 'valid', 'invalid', 'unknown', 'catch_all', etc.
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
      
      // Map Clearout status to our status types
      let mappedStatus: EmailVariation['status'];
      if (status === 'valid') {
        mappedStatus = 'valid';
      } else if (status === 'invalid') {
        mappedStatus = 'invalid';
      } else if (status === 'catch_all') {
        mappedStatus = 'catch_all';
      } else if (status === 'rate_limited') {
        mappedStatus = 'rate_limited';
      } else {
        mappedStatus = 'unknown';
      }
      
      const variation: EmailVariation = {
        email,
        status: mappedStatus,
        result,
      };
      
      results.push(variation);
      
      // If we found a valid email, we can stop
      if (status === 'valid') {
        validEmail = email;
        console.log(`Found valid email: ${email}`);
        break;
      }
      
      // If we hit rate limits even after retries, stop checking more variations
      if (status === 'rate_limited') {
        console.warn('Stopping due to rate limits');
        break;
      }
      
      // Add delay between requests to avoid rate limiting (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
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
