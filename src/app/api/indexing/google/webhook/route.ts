import { NextResponse } from 'next/server';
import {
  getServiceAccountCredentials,
  getSiteUrl,
  publishGoogleIndexingNotification,
  toAbsoluteSiteUrl,
  type IndexingType,
} from '@/lib/indexing/googleIndexing';

type WebhookEvent = 'created' | 'updated' | 'deleted';

interface WebhookRequest {
  event?: WebhookEvent;
  path?: string;
  url?: string;
}

function json(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function mapEventToType(event: WebhookEvent): IndexingType {
  return event === 'deleted' ? 'URL_DELETED' : 'URL_UPDATED';
}

export async function POST(request: Request) {
  const sharedKey = process.env.INDEXING_API_SHARED_KEY;
  if (!sharedKey) {
    return json(500, { error: 'server_not_configured', missing: ['INDEXING_API_SHARED_KEY'] });
  }

  const incomingKey = request.headers.get('x-indexing-key');
  if (!incomingKey || incomingKey !== sharedKey) {
    return json(401, { error: 'unauthorized' });
  }

  if (!getServiceAccountCredentials()) {
    return json(500, {
      error: 'server_not_configured',
      missing: [
        'GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON',
        'GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON_BASE64',
        'GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      ],
    });
  }

  let body: WebhookRequest;
  try {
    body = (await request.json()) as WebhookRequest;
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

  const siteUrl = getSiteUrl();
  const resolvedUrl = toAbsoluteSiteUrl(rawTarget, siteUrl);
  if (!resolvedUrl) {
    return json(400, { error: 'invalid_url', message: 'Only URLs for this canonical host are accepted.' });
  }

  try {
    const type = mapEventToType(event);
    const google = await publishGoogleIndexingNotification({ url: resolvedUrl, type });

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
}
