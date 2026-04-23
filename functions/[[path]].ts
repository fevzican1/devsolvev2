import { buildSectionFallbackHtml } from './_shared/sectionFallback';
import {
  CONTENT_SIGNAL_HEADER,
  CONTENT_SIGNAL_VALUE,
} from '../src/lib/seo/contentSignal';
import { guideRegistry } from '../src/content/guides';
import { siteConfig } from '../src/config/site';
import { toolRegistry } from '../src/tools/registry';

interface EventContext<Env> {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  next(): Promise<Response>;
}

type PagesFunction<Env = unknown> = (context: EventContext<Env>) => Response | Promise<Response>;

interface Env {}

const responseHeaders = {
  'Content-Type': 'text/html;charset=UTF-8',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  'X-Robots-Tag': 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  [CONTENT_SIGNAL_HEADER]: CONTENT_SIGNAL_VALUE,
};

function isHtmlNavigation(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  const secFetchDest = request.headers.get('sec-fetch-dest') ?? '';
  const primaryAcceptedType = accept
    .split(',')
    .map((value) => value.trim().split(';')[0])
    .find(Boolean);

  return (
    request.method === 'GET' &&
    (secFetchDest === 'document' ||
      primaryAcceptedType === 'text/html' ||
      primaryAcceptedType === 'application/xhtml+xml')
  );
}

function buildGlobalFallbackHtml(siteUrl: string, requestedPath?: string) {
  return buildSectionFallbackHtml(
    {
      canonicalPath: '/',
      title: `${siteConfig.name} — Free Privacy-First Developer Tools & Guides`,
      description: siteConfig.description,
      requestedPath,
      featuredLinks: [
        {
          href: '/tools',
          label: 'Developer Tools',
          description: `Browse ${toolRegistry.length}+ browser-based tools with stable crawlable URLs.`,
        },
        {
          href: '/guides',
          label: 'Technical Guides',
          description: `Explore ${guideRegistry.length}+ editorial guides and workflow pages.`,
        },
        {
          href: '/k',
          label: 'Programmatic Library',
          description: 'Open the indexed /k hub instead of ending on a missing path.',
        },
        ...toolRegistry.slice(0, 4).map((tool) => ({
          href: `/tools/${tool.slug}`,
          label: tool.name,
          description: tool.shortDescription,
        })),
        ...guideRegistry.slice(0, 2).map((guide) => ({
          href: `/guides/${guide.slug}`,
          label: guide.title,
          description: guide.description,
        })),
      ],
    },
    siteUrl,
  );
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  try {
    const response = await context.next();

    if (response.status === 200) {
      const headers = new Headers(response.headers);
      headers.set(CONTENT_SIGNAL_HEADER, CONTENT_SIGNAL_VALUE);

      const contentType = headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        headers.set('X-Robots-Tag', responseHeaders['X-Robots-Tag']);
      }

      return new Response(response.body, {
        status: 200,
        headers,
      });
    }

    if (!isHtmlNavigation(context.request)) {
      return response;
    }

    return new Response(buildGlobalFallbackHtml(url.origin, url.pathname), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Global HTML fallback handler error', error);

    if (!isHtmlNavigation(context.request)) {
      return new Response(null, { status: 500 });
    }

    return new Response(buildGlobalFallbackHtml(url.origin, url.pathname), {
      status: 200,
      headers: responseHeaders,
    });
  }
};
