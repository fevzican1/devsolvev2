declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

interface IndexNowRequest {
  urls?: string[];
  url?: string;
}

const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
];

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isAllowedUrl(url: string, siteUrl: string): boolean {
  try {
    const candidate = new URL(url);
    const canonical = new URL(siteUrl);
    return candidate.protocol === 'https:' && candidate.hostname === canonical.hostname;
  } catch {
    return false;
  }
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const sharedKey = Netlify.env.get('INDEXING_API_SHARED_KEY');
  if (!sharedKey) {
    return json(500, { error: 'server_not_configured' });
  }

  const inboundKey = req.headers.get('x-indexing-key');
  if (!inboundKey || inboundKey !== sharedKey) {
    return json(401, { error: 'unauthorized' });
  }

  const indexNowKey = Netlify.env.get('INDEXNOW_KEY');
  if (!indexNowKey) {
    return json(500, { error: 'server_not_configured', missing: ['INDEXNOW_KEY'] });
  }

  const siteUrl = Netlify.env.get('SITE_URL') || Netlify.env.get('URL') || 'https://devsolvev2.com';
  const host = new URL(siteUrl).hostname;

  let body: IndexNowRequest;
  try {
    body = (await req.json()) as IndexNowRequest;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const rawUrls = body.urls ?? (body.url ? [body.url] : []);
  const validUrls = rawUrls
    .map((u) => u.trim())
    .filter((u) => isAllowedUrl(u, siteUrl));

  if (validUrls.length === 0) {
    return json(400, { error: 'no_valid_urls' });
  }

  const capped = validUrls.slice(0, 10000);

  const results: Array<{ endpoint: string; status: number }> = [];

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          key: indexNowKey,
          keyLocation: `${siteUrl}/${indexNowKey}.txt`,
          urlList: capped,
        }),
      });
      results.push({ endpoint, status: response.status });
    } catch {
      results.push({ endpoint, status: 0 });
    }
  }

  return json(200, {
    ok: true,
    submitted: capped.length,
    results,
  });
};

export const config = {
  path: '/api/indexnow',
  method: 'POST',
};
