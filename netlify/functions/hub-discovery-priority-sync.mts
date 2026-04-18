import { writeDiscoveredPriorityUrls } from '../../src/lib/indexing/hubDiscovery';

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

interface PrioritySyncBody {
  urls?: string[];
  mode?: 'replace' | 'append';
  chunkSize?: number;
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

  const expectedKey = Netlify.env.get('HUB_DISCOVERY_PRIORITY_KEY') || Netlify.env.get('INDEXING_API_SHARED_KEY');
  const inboundKey = req.headers.get('x-hub-priority-key');

  if (!expectedKey || !inboundKey || inboundKey !== expectedKey) {
    return json(401, { error: 'unauthorized' });
  }

  let body: PrioritySyncBody;
  try {
    body = (await req.json()) as PrioritySyncBody;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return json(400, {
      error: 'invalid_payload',
      message: 'Body must include a non-empty urls array.',
    });
  }

  const siteUrl = Netlify.env.get('SITE_URL') || Netlify.env.get('URL') || 'https://devsolvev2.com';

  const result = await writeDiscoveredPriorityUrls({
    urls: body.urls,
    siteUrl,
    mode: body.mode === 'append' ? 'append' : 'replace',
    chunkSize: body.chunkSize,
  });

  return json(200, {
    ok: true,
    accepted: result.accepted,
    chunkCount: result.chunkCount,
    total: result.total,
  });
};

export const config = {
  path: '/api/hub-discovery-priority-sync',
};
