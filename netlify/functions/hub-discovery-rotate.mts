import { getStore } from '@netlify/blobs';
import {
  DEFAULT_HUB_PATHS,
  refreshHubLinks,
  toAbsoluteSiteUrl,
  normalizeHubPath,
} from '../../src/lib/indexing/hubDiscovery';
import { isAllowedUrl, publishIndexingNotification } from './_lib/google-indexing-client.mjs';

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

interface PingState {
  [hubPath: string]: string;
}

const PING_STATE_KEY = 'state:hub-pings';
const PING_STATE_STORE = 'hub-discovery-links';

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isScheduledInvocation(req: Request): boolean {
  return req.headers.get('x-nf-event') === 'schedule';
}

function parseHubPaths(raw: string | undefined): string[] {
  if (!raw) return [...DEFAULT_HUB_PATHS];

  const paths = raw
    .split(',')
    .map((item) => normalizeHubPath(item.trim()))
    .filter(Boolean);

  return paths.length > 0 ? paths : [...DEFAULT_HUB_PATHS];
}

function parseFiniteInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  const int = Math.trunc(parsed);
  return Math.min(max, Math.max(min, int));
}

function pingIsDue(lastPingAt: string | undefined, minIntervalMinutes: number): boolean {
  if (!lastPingAt) return true;
  const lastMs = Date.parse(lastPingAt);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs > minIntervalMinutes * 60_000;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const isScheduled = isScheduledInvocation(req);
  const rotationKey = Netlify.env.get('HUB_DISCOVERY_ROTATION_KEY') || Netlify.env.get('INDEXING_API_SHARED_KEY');

  if (!isScheduled) {
    const inboundKey = req.headers.get('x-hub-rotation-key');
    if (!rotationKey || !inboundKey || inboundKey !== rotationKey) {
      return json(401, { error: 'unauthorized' });
    }
  }

  const siteUrl = Netlify.env.get('SITE_URL') || Netlify.env.get('URL') || 'https://devsolvev2.com';
  const hubPaths = parseHubPaths(Netlify.env.get('HUB_DISCOVERY_HUB_PATHS'));
  const linksPerHub = parseFiniteInt(Netlify.env.get('HUB_DISCOVERY_LINKS_PER_HUB'), 20, 1, 500);
  const refreshMinutes = parseFiniteInt(Netlify.env.get('HUB_DISCOVERY_REFRESH_MINUTES'), 180, 5, 10_080);
  const minPingMinutes = parseFiniteInt(Netlify.env.get('HUB_DISCOVERY_MIN_PING_MINUTES'), 180, 10, 10_080);

  const serviceAccountEmail = Netlify.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const serviceAccountPrivateKey = Netlify.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

  const store = getStore(PING_STATE_STORE);
  const pingState = (await store.get(PING_STATE_KEY, { type: 'json' }) as PingState | null) ?? {};

  const summary = [] as Array<Record<string, unknown>>;

  for (const hubPath of hubPaths) {
    const refreshed = await refreshHubLinks({
      hubPath,
      siteUrl,
      count: linksPerHub,
      refreshMinutes,
      force: true,
    });

    const absoluteHubUrl = toAbsoluteSiteUrl(siteUrl, hubPath);
    const shouldPing =
      Boolean(serviceAccountEmail && serviceAccountPrivateKey)
      && isAllowedUrl(absoluteHubUrl, siteUrl)
      && pingIsDue(pingState[hubPath], minPingMinutes);

    let pingSent = false;
    let pingError: string | null = null;

    if (shouldPing) {
      try {
        await publishIndexingNotification({
          serviceAccountEmail: serviceAccountEmail as string,
          serviceAccountPrivateKey: serviceAccountPrivateKey as string,
          url: absoluteHubUrl,
          type: 'URL_UPDATED',
        });
        pingState[hubPath] = new Date().toISOString();
        pingSent = true;
      } catch {
        pingError = 'google_ping_failed';
      }
    }

    summary.push({
      hubPath,
      generatedAt: refreshed.generatedAt,
      linkCount: refreshed.links.length,
      pingSent,
      pingError,
    });
  }

  await store.setJSON(PING_STATE_KEY, pingState);

  return json(200, {
    ok: true,
    hubsProcessed: summary.length,
    summary,
    note: 'Hub pages were refreshed and eligible hubs were pinged with URL_UPDATED.',
  });
};

export const config = {
  method: ['GET', 'POST'],
  schedule: '0 */1 * * *',
};
