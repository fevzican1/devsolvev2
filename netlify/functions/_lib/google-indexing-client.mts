import { createSign } from 'node:crypto';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/indexing';

export type IndexingType = 'URL_UPDATED' | 'URL_DELETED';

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

export function isAllowedUrl(url: string, siteUrl: string): boolean {
  try {
    const candidate = new URL(url);
    const canonicalSite = new URL(siteUrl);
    return candidate.protocol === 'https:' && candidate.hostname === canonicalSite.hostname;
  } catch {
    return false;
  }
}

export async function publishIndexingNotification(options: {
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  url: string;
  type: IndexingType;
}): Promise<Record<string, unknown>> {
  const accessToken = await getAccessToken(options.serviceAccountEmail, options.serviceAccountPrivateKey);

  const response = await fetch(GOOGLE_INDEXING_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: options.url,
      type: options.type,
    }),
  });

  if (!response.ok) {
    throw new Error(`google_indexing_failed:${response.status}`);
  }

  return await response.json() as Record<string, unknown>;
}
