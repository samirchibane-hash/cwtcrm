import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIGNATURE = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

async function getGmailToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Failed to get Gmail token: ${JSON.stringify(data)}`);
  return data.access_token;
}

function buildHtmlEmail(firstName: string, bodyTemplate: string, companyName: string): string {
  const personalized = bodyTemplate
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{companyName\}/g, companyName);
  const htmlBody = personalized
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return `<div dir="ltr">\n${htmlBody}<br><br>\n${SIGNATURE}\n</div>`;
}

function makeMime(from: string, to: string, subject: string, htmlBody: string): string {
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join('\r\n');
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createDraft(token: string, raw: string): Promise<void> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
}

async function sendMessage(token: string, raw: string): Promise<void> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      contacts,      // { name: string, email: string }[]
      subject,
      bodyTemplate,  // plain text with {firstName} and {companyName} placeholders
      mode,          // 'draft' | 'send'
      companyName,
    } = await req.json();

    const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('VITE_GOOGLE_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN');
    const FROM = 'samir@canopuswatertechnologies.com';

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      throw new Error('Missing Gmail OAuth credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN as Supabase secrets.');
    }

    const token = await getGmailToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN);

    let count = 0;
    const errors: string[] = [];

    for (const contact of contacts as { name: string; email: string }[]) {
      const firstName = contact.name.split(' ')[0];
      const html = buildHtmlEmail(firstName, bodyTemplate, companyName);
      const raw = makeMime(FROM, contact.email, subject, html);
      try {
        if (mode === 'send') {
          await sendMessage(token, raw);
        } else {
          await createDraft(token, raw);
        }
        count++;
      } catch (e: any) {
        errors.push(`${contact.email}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ count, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('send-outreach error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
