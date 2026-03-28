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

interface IndexingRequest {
  url?: string;
  type?: IndexingType;
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
    const payload = await publishIndexingNotification({
      serviceAccountEmail,
      serviceAccountPrivateKey,
      url,
      type,
    });

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
