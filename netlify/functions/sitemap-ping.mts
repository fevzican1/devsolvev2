declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

const PING_ENDPOINTS = [
  'https://www.bing.com/ping?sitemap=',
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

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const sharedKey = Netlify.env.get('INDEXING_API_SHARED_KEY');
  if (!sharedKey) {
    return json(500, { error: 'server_misconfigured', message: 'INDEXING_API_SHARED_KEY is not set' });
  }
  const inboundKey = req.headers.get('x-indexing-key');
  if (!inboundKey || inboundKey !== sharedKey) {
    return json(401, { error: 'unauthorized' });
  }

  const siteUrl = Netlify.env.get('SITE_URL') || Netlify.env.get('URL') || 'https://devsolvev2.com';
  const sitemapUrl = `${siteUrl}/sitemap-index.xml`;

  const results: Array<{ endpoint: string; status: number }> = [];

  for (const endpoint of PING_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}${encodeURIComponent(sitemapUrl)}`, {
        method: 'GET',
      });
      results.push({ endpoint, status: response.status });
    } catch {
      results.push({ endpoint, status: 0 });
    }
  }

  return json(200, {
    ok: true,
    sitemapUrl,
    results,
  });
};

export const config = {
  path: '/api/sitemap-ping',
  method: 'POST',
};
