import {
  isAllowedUrl,
  type IndexingType,
  publishIndexingNotification,
} from './_lib/google-indexing-client.mjs';

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

type WebhookEvent = 'created' | 'updated' | 'deleted';

interface WebhookRequest {
  event?: WebhookEvent;
  path?: string;
  url?: string;
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

function mapEventToType(event: WebhookEvent): IndexingType {
  return event === 'deleted' ? 'URL_DELETED' : 'URL_UPDATED';
}

function toAbsoluteSiteUrl(value: string, siteUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const asUrl = new URL(trimmed);
    return isAllowedUrl(asUrl.toString(), siteUrl) ? asUrl.toString() : null;
  } catch {
    try {
      const absolute = new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, siteUrl);
      return isAllowedUrl(absolute.toString(), siteUrl) ? absolute.toString() : null;
    } catch {
      return null;
    }
  }
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

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    const missing = [] as string[];
    if (!serviceAccountEmail) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!serviceAccountPrivateKey) missing.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    return json(500, { error: 'server_not_configured', missing });
  }

  let body: WebhookRequest;
  try {
    body = (await req.json()) as WebhookRequest;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const event = body.event ?? 'updated';
  if (!['created', 'updated', 'deleted'].includes(event)) {
    return json(400, { error: 'invalid_event' });
  }

  const rawTarget = body.url?.trim() || body.path?.trim();
  if (!rawTarget) {
    return json(400, { error: 'missing_url_or_path' });
  }

  const resolvedUrl = toAbsoluteSiteUrl(rawTarget, siteUrl);
  if (!resolvedUrl) {
    return json(400, { error: 'invalid_url', message: 'Only URLs for this canonical host are accepted.' });
  }

  try {
    const type = mapEventToType(event);
    const google = await publishIndexingNotification({
      serviceAccountEmail,
      serviceAccountPrivateKey,
      url: resolvedUrl,
      type,
    });

    return json(200, {
      ok: true,
      event,
      type,
      url: resolvedUrl,
      google,
    });
  } catch {
    return json(502, { error: 'google_auth_or_publish_failed' });
  }
};

export const config = {
  path: '/api/google-indexing/webhook',
  method: 'POST',
};
