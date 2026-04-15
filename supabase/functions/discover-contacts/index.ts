import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Scoring lists (mirrors outreach-agent.mjs) ───────────────────────────────

const BROAD_KEEP = [
  'president', 'owner', 'founder', 'ceo', 'coo', 'cto', 'cfo', 'chief',
  'vp', 'vice president',
  'director', 'general manager',
  'engineer', 'engineering', 'technical', 'technician',
  'r&d', 'research', 'research and development', 'development',
  'quality', 'quality control', 'quality assurance', 'manufacturing',
  'service manager', 'service tech', 'service director', 'service coordinator',
  'service', 'warranty manager', 'warranty',
  'product manager', 'product development', 'product director', 'product',
  'water', 'water treatment', 'water filtration', 'water quality', 'water systems',
  'spa', 'hot tub', 'aquatic',
  'procurement', 'purchasing', 'buyer', 'supply chain', 'operations', 'inventory',
  'business development',
];

const BROAD_SKIP = [
  'sales representative', 'sales rep', 'field sales', 'inside sales', 'outside sales',
  'account executive', 'territory manager', 'territory sales', 'territory',
  'salesperson', 'sales consultant', 'sales associate', 'sales professional',
  'regional sales manager', 'brand ambassador', 'appointment setter', 'referral',
  'dealer support', 'dealer development', 'dealer representative',
  'marketing manager', 'marketing coordinator', 'marketing specialist',
  'marketing representative', 'marketing agent', 'marketing content',
  'graphic designer', 'graphic design',
  'warehouse', 'driver', 'delivery', 'forklift', 'installer', 'installation technician',
  'receptionist', 'administrative assistant', 'dispatcher', 'schedule planner',
  'human resources', 'hr ', 'recruiter', 'talent acquisition',
  'payroll', 'bookkeeper', 'accounts payable', 'accounts receivable', 'accounting clerk',
  'controller', 'finance', 'accountant',
  'intern', 'co-op', 'apprentice', 'laborer', 'labourer',
  'retail', 'store manager', 'store associate',
];

const HOOKS: Record<string, string> = {
  'Ice Machines': `Several ice machine OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Water Coolers': `Several water cooler OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Fountains': `Several water fountain OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Beverage Dispensers': `Several beverage dispensing OEMs now prefer our LED based UV-C systems for keeping water lines clean since they're compact, long-lasting, and don't affect water temperatures.`,
  'Water Filtration': `Several water filtration OEMs now prefer our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'Spas & Hot Tubs': `Several spa and hot tub OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and easy to maintain.`,
  'Industrial': `Several industrial water treatment OEMs now prefer our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'Distributor': `Several water treatment distributors now carry our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'default': `Several water treatment companies now prefer our LED based UV-C systems because they are compact, mercury-free, long-lasting, and the external maintenance only takes seconds.`,
};

const DRIVE_LINK = 'https://drive.google.com/drive/folders/1Pb8pPqPLei7VxoSe3FWT7IQZ93-dnT3q?usp=sharing';

function selectHook(marketType: string, companyType: string): string {
  if (marketType && HOOKS[marketType]) return HOOKS[marketType];
  if (companyType === 'Distributor') return HOOKS['Distributor'];
  return HOOKS['default'];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Apollo helpers ────────────────────────────────────────────────────────────

async function apolloFindOrg(name: string, apiKey: string): Promise<any> {
  const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ q_organization_name: name, page: 1, per_page: 5 }),
  });
  if (!res.ok) throw new Error(`Apollo org search ${res.status}`);
  const data = await res.json();
  return (data.organizations || [])[0] || null;
}

async function apolloSearchPage(orgId: string, page: number, apiKey: string): Promise<any[]> {
  const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ organization_ids: [orgId], page, per_page: 25 }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.people || [];
}

async function apolloEnrich(personId: string, apiKey: string): Promise<any> {
  const res = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ id: personId, reveal_personal_emails: false }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.person || null;
}

// ── Clearout ──────────────────────────────────────────────────────────────────

async function verifyEmail(email: string, clearoutKey: string) {
  const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer:${clearoutKey}` },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { verified: false, catchAll: false, status: 'error' };
  const data = await res.json();
  return {
    status: data.data?.status || 'unknown',
    verified: data.data?.status === 'valid' || data.data?.safe_to_send === 'yes',
    catchAll: data.data?.is_catch_all === 'yes',
  };
}

// ── Email format detection ────────────────────────────────────────────────────

function detectEmailFormat(contacts: any[], domain: string): string | null {
  for (const c of contacts) {
    if (!c.email || !c.name) continue;
    const parts = c.name.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) continue;
    const [first, ...rest] = parts;
    const last = rest.join('');
    const f = first[0];
    const local = c.email.split('@')[0].toLowerCase();
    if (local === `${f}${last}`) return 'flast';
    if (local === `${first}.${last}`) return 'first.last';
    if (local === `${first}${last}`) return 'firstlast';
    if (local === `${f}.${last}`) return 'f.last';
    if (local === `${last}.${first}`) return 'last.first';
    if (local === `${last}${f}`) return 'lastf';
    if (local === first) return 'first';
  }
  return null;
}

function generateEmail(name: string, format: string, domain: string): string | null {
  const parts = name.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  const [first, ...rest] = parts;
  const last = rest.join('');
  const f = first[0];
  switch (format) {
    case 'flast': return `${f}${last}@${domain}`;
    case 'first.last': return `${first}.${last}@${domain}`;
    case 'firstlast': return `${first}${last}@${domain}`;
    case 'f.last': return `${f}.${last}@${domain}`;
    case 'last.first': return `${last}.${first}@${domain}`;
    case 'lastf': return `${last}${f}@${domain}`;
    case 'first': return `${first}@${domain}`;
    default: return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      orgName,
      existingIds = [],
      existingLinkedIns = [],
      marketType = '',
      companyType = '',
      limit = 40,
    } = await req.json();

    const APOLLO_KEY = Deno.env.get('APOLLO_API');
    const CLEAROUT_KEY = Deno.env.get('CLEAROUT_API_KEY');

    if (!APOLLO_KEY || !CLEAROUT_KEY) {
      throw new Error('Missing APOLLO_API or CLEAROUT_API_KEY secrets');
    }

    const existingIdSet = new Set(existingIds as string[]);
    const existingLinkedInSet = new Set((existingLinkedIns as string[]).filter(Boolean));
    const hook = selectHook(marketType, companyType);

    // 1. Find Apollo org
    const org = await apolloFindOrg(orgName, APOLLO_KEY);
    if (!org) {
      return new Response(JSON.stringify({ error: `"${orgName}" not found in Apollo` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Broad search (all pages)
    const seen = new Map<string, any>();
    for (let page = 1; page <= 10; page++) {
      const people = await apolloSearchPage(org.id, page, APOLLO_KEY);
      if (people.length === 0) break;
      people.forEach((p: any) => { if (p.id && !seen.has(p.id)) seen.set(p.id, p); });
      if (people.length < 25) break;
      await delay(250);
    }

    // 3. Score and filter
    const relevant = [...seen.values()]
      .filter(p => p.first_name)
      .filter(p => !BROAD_SKIP.some(s => (p.title || '').toLowerCase().includes(s)))
      .map(p => {
        const t = (p.title || '').toLowerCase();
        const score = BROAD_KEEP.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
        return { ...p, _score: score };
      })
      .filter(p => p._score >= 1)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit > 0 ? limit : 40);

    // 4. Enrich via Apollo people/match
    const enriched: any[] = [];
    for (const person of relevant) {
      try {
        const full = await apolloEnrich(person.id, APOLLO_KEY);
        if (full) {
          enriched.push({
            apolloId: person.id,
            name: full.name || `${full.first_name} ${full.last_name}`.trim(),
            title: full.title || person.title || '',
            email: full.email || '',
            linkedIn: full.linkedin_url || '',
          });
        }
      } catch {
        // skip failed enrichments
      }
      await delay(300);
    }

    // 5. Guess missing emails
    const withEmails = enriched.filter(c => c.email);
    const withoutEmails = enriched.filter(c => !c.email);
    if (withoutEmails.length > 0 && withEmails.length > 0) {
      const knownDomain = withEmails[0].email.split('@')[1];
      const format = detectEmailFormat(withEmails, knownDomain);
      if (format) {
        for (const contact of withoutEmails) {
          const guess = generateEmail(contact.name, format, knownDomain);
          if (guess) {
            const v = await verifyEmail(guess, CLEAROUT_KEY);
            if (v.verified || v.catchAll) contact.email = guess;
            await delay(250);
          }
        }
      }
    }

    // 6. Verify emails with Clearout
    const results: any[] = [];
    for (const contact of enriched) {
      if (!contact.email) {
        results.push({ ...contact, emailStatus: 'no_email', verified: false, catchAll: false });
        continue;
      }
      const v = await verifyEmail(contact.email, CLEAROUT_KEY);
      results.push({
        ...contact,
        emailStatus: v.verified ? 'valid' : v.catchAll ? 'catch-all' : 'unverified',
        verified: v.verified,
        catchAll: v.catchAll,
      });
      await delay(200);
    }

    // 7. Mark already-in-CRM
    const contacts = results.map(r => ({
      ...r,
      alreadyInCrm:
        existingIdSet.has(`contact-apollo-${r.apolloId}`) ||
        (r.linkedIn && existingLinkedInSet.has(r.linkedIn)),
    }));

    // 8. Build email templates
    const bodyTemplate = [
      `Hey {firstName},`,
      ``,
      hook,
      ``,
      `You can find our brochure and tech sheets here: ${DRIVE_LINK}`,
      ``,
      `Let me know your availability this week or the next for a technical discussion on how we can best support your applications at {companyName}.`,
    ].join('\n');

    const wqaBodyTemplate = [
      `Hey {firstName},`,
      ``,
      `Will you or your team be at the upcoming WQA in Miami?`,
      ``,
      `${hook} Most importantly, the external maintenance only takes seconds.`,
      ``,
      `Refer to our brochure and tech sheets here: ${DRIVE_LINK}`,
      ``,
      `If not, we can schedule a time next week for a technical discussion on how we can best support your applications at {companyName}.`,
    ].join('\n');

    return new Response(JSON.stringify({
      contacts,
      hook,
      bodyTemplate,
      wqaBodyTemplate,
      orgId: org.id,
      orgName: org.name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('discover-contacts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
