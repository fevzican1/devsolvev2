import { createSign } from 'node:crypto';

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/indexing';

interface IndexingRequest {
  url?: string;
  type?: 'URL_UPDATED' | 'URL_DELETED';
}

function b64url(value: string | Buffer): string {
  const input = typeof value === 'string' ? Buffer.from(value) : value;
  return input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizePrivateKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function buildJwt(serviceAccountEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const payload = {
    iss: serviceAccountEmail,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(normalizePrivateKey(privateKey));
  return `${signingInput}.${b64url(signature)}`;
}

async function getAccessToken(serviceAccountEmail: string, privateKey: string): Promise<string> {
  const assertion = buildJwt(serviceAccountEmail, privateKey);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`token_request_failed:${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };

  if (!payload.access_token) {
    throw new Error('token_missing');
  }

  return payload.access_token;
}

function isAllowedUrl(url: string, siteUrl: string): boolean {
  try {
    const candidate = new URL(url);
    const canonicalSite = new URL(siteUrl);
    return candidate.protocol === 'https:' && candidate.hostname === canonicalSite.hostname;
  } catch {
    return false;
  }
}

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const sharedKey = Netlify.env.get('INDEXING_API_SHARED_KEY');
  if (!sharedKey) {
    return json(500, { error: 'server_not_configured', missing: ['INDEXING_API_SHARED_KEY'] });
  }

  const inboundKey = req.headers.get('x-indexing-key');
  if (!inboundKey || inboundKey !== sharedKey) {
    return json(401, { error: 'unauthorized' });
  }

  const serviceAccountEmail = Netlify.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const serviceAccountPrivateKey = Netlify.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  const siteUrl = Netlify.env.get('SITE_URL') || Netlify.env.get('URL') || 'https://devsolvev2.com';

  const missing = [] as string[];
  if (!serviceAccountEmail) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!serviceAccountPrivateKey) missing.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  if (missing.length > 0) {
    return json(500, { error: 'server_not_configured', missing });
  }

  let body: IndexingRequest;
  try {
    body = (await req.json()) as IndexingRequest;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const url = body.url?.trim();
  const type = body.type ?? 'URL_UPDATED';

  if (!url || !isAllowedUrl(url, siteUrl)) {
    return json(400, {
      error: 'invalid_url',
      message: 'Only HTTPS URLs for this site are accepted.',
    });
  }

  if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
    return json(400, { error: 'invalid_type' });
  }

  try {
    const accessToken = await getAccessToken(serviceAccountEmail, serviceAccountPrivateKey);
    const response = await fetch(GOOGLE_INDEXING_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type }),
    });

    if (!response.ok) {
      return json(502, {
        error: 'google_indexing_failed',
        status: response.status,
      });
    }

    const payload = await response.json();
    return json(200, {
      ok: true,
      url,
      type,
      google: payload,
      note: 'Google Indexing API works only for specific page types accepted by Google.',
    });
  } catch {
    return json(502, { error: 'google_auth_or_publish_failed' });
  }
};

export const config = {
  path: '/api/google-indexing',
  method: 'POST',
};
