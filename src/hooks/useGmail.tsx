import { useState, useCallback } from 'react';

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export function useGmail() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const requestToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || 'Failed to get access token'));
          } else {
            setAccessToken(response.access_token);
            resolve(response.access_token);
          }
        },
      });
      client.requestAccessToken();
    });
  }, []);

  const sendEmail = useCallback(async (to: string, subject: string, body: string) => {
    setSending(true);
    try {
      const token = accessToken || await requestToken();

      const message = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        `Subject: ${subject}`,
        '',
        body,
      ].join('\r\n');

      const encoded = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Token may have expired — clear it and retry once
        if (res.status === 401) {
          setAccessToken(null);
          const newToken = await requestToken();
          const retry = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: encoded }),
          });
          if (!retry.ok) throw new Error('Failed to send email');
        } else {
          throw new Error(err?.error?.message || 'Failed to send email');
        }
      }
    } finally {
      setSending(false);
    }
  }, [accessToken, requestToken]);

  return { sendEmail, sending };
}
