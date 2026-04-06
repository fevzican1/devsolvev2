import { createSign } from 'node:crypto';
import { siteConfig } from '@/config/site';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/indexing';

export type IndexingType = 'URL_UPDATED' | 'URL_DELETED';

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

function b64url(value: string | Buffer): string {
  const input = typeof value === 'string' ? Buffer.from(value) : value;
  return input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizePrivateKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function parseServiceAccountJson(raw: string): ServiceAccountCredentials | null {
  try {
    const parsed = JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
    };

    if (!parsed.client_email || !parsed.private_key) return null;

    return {
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  } catch {
    return null;
  }
}

export function getSiteUrl(): string {
  return process.env.SITE_URL || process.env.URL || siteConfig.siteUrl;
}

export function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  const jsonKey = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
  if (jsonKey) {
    const parsed = parseServiceAccountJson(jsonKey);
    if (parsed) return parsed;
  }

  const base64JsonKey = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON_BASE64;
  if (base64JsonKey) {
    try {
      const decoded = Buffer.from(base64JsonKey, 'base64').toString('utf-8');
      const parsed = parseServiceAccountJson(decoded);
      if (parsed) return parsed;
    } catch {
      // Ignore and continue with fallback credentials.
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;

  return {
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function buildJwt(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
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

  const signature = signer.sign(privateKey);
  return `${signingInput}.${b64url(signature)}`;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const assertion = buildJwt(credentials.clientEmail, credentials.privateKey);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`token_request_failed:${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error('token_missing');

  return payload.access_token;
}

export function isAllowedSiteUrl(url: string, siteUrl: string): boolean {
  try {
    const candidate = new URL(url);
    const canonical = new URL(siteUrl);
    return candidate.protocol === 'https:' && candidate.hostname === canonical.hostname;
  } catch {
    return false;
  }
}

export function toAbsoluteSiteUrl(pathOrUrl: string, siteUrl: string): string | null {
  try {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return isAllowedSiteUrl(pathOrUrl, siteUrl) ? pathOrUrl : null;
    }

    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    const resolved = new URL(normalizedPath, siteUrl).toString();
    return isAllowedSiteUrl(resolved, siteUrl) ? resolved : null;
  } catch {
    return null;
  }
}

export async function publishGoogleIndexingNotification(options: {
  url: string;
  type: IndexingType;
}): Promise<Record<string, unknown>> {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    throw new Error('missing_service_account_credentials');
  }

  const accessToken = await getAccessToken(credentials);

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
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`google_indexing_failed:${response.status}`);
  }

  return await response.json() as Record<string, unknown>;
}
