// Shared Gmail helpers for edge functions that send on Samir's behalf via the
// long-lived OAuth refresh token (no third-party sending service involved).

export const SIGNATURE = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

export const FROM_EMAIL = 'samir@canopuswatertechnologies.com';

export async function getGmailToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('VITE_GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Gmail OAuth credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN as Supabase secrets.',
    );
  }

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
  return data.access_token as string;
}

/** Substitutes {mergeField} tokens. Used for subject lines as well as bodies. */
export function applyVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return out;
}

/** Renders plain-text body + merge fields into signed HTML. */
export function renderBody(body: string, vars: Record<string, string>): string {
  const html = applyVars(body, vars).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return `<div dir="ltr">\n${html}<br><br>\n${SIGNATURE}\n</div>`;
}

export interface MimeOpts {
  inReplyTo?: string;
  references?: string;
}

export function makeMime(to: string, subject: string, htmlBody: string, opts: MimeOpts = {}): string {
  const headers: string[] = [`From: ${FROM_EMAIL}`, `To: ${to}`, `Subject: ${subject}`];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  headers.push('MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', '');

  const raw = [...headers, htmlBody].join('\r\n');
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendMessage(
  token: string,
  raw: string,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const body: Record<string, unknown> = { raw };
  if (threadId) body.threadId = threadId;
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  return await res.json() as { id: string; threadId: string };
}

/** The RFC Message-ID, needed as In-Reply-To so the next touch threads correctly. */
export async function getRfcMessageId(token: string, gmailId: string): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=metadata&metadataHeaders=Message-ID`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return '';
  const data = await res.json() as { payload?: { headers?: { name: string; value: string }[] } };
  return data.payload?.headers?.find((h) => h.name === 'Message-ID')?.value ?? '';
}

/**
 * True when anyone other than us has posted to the thread — the signal to stop
 * a sequence. Returns false for a deleted thread (404) so a missing thread
 * never silently halts a workflow.
 */
export async function threadHasReply(token: string, threadId: string): Promise<boolean> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return false;
  const data = await res.json() as {
    messages?: { payload?: { headers?: { name: string; value: string }[] } }[];
  };
  return (data.messages ?? []).some((m) => {
    const from = m.payload?.headers?.find((h) => h.name === 'From')?.value ?? '';
    return from !== '' && !from.toLowerCase().includes(FROM_EMAIL);
  });
}
