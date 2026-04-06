import { NextResponse } from 'next/server';
import {
  getServiceAccountCredentials,
  getSiteUrl,
  isAllowedSiteUrl,
  publishGoogleIndexingNotification,
  type IndexingType,
} from '@/lib/indexing/googleIndexing';

interface SubmitRequest {
  url?: string;
  type?: IndexingType;
}

function json(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
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

  let body: SubmitRequest;
  try {
    body = (await request.json()) as SubmitRequest;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const siteUrl = getSiteUrl();
  const url = body.url?.trim();
  const type = body.type ?? 'URL_UPDATED';

  if (!url || !isAllowedSiteUrl(url, siteUrl)) {
    return json(400, { error: 'invalid_url', message: 'Only HTTPS URLs under the canonical host are accepted.' });
  }

  if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
    return json(400, { error: 'invalid_type' });
  }

  try {
    const google = await publishGoogleIndexingNotification({ url, type });
    return json(200, { ok: true, url, type, google });
  } catch {
    return json(502, { error: 'google_auth_or_publish_failed' });
  }
}
