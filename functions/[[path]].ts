import { buildSectionFallbackHtml } from './_shared/sectionFallback';
import { shouldServeHtmlFallback } from './_shared/requestRouting';
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
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=172800',
  'X-Robots-Tag': 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  [CONTENT_SIGNAL_HEADER]: CONTENT_SIGNAL_VALUE,
};

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
    if (!shouldServeHtmlFallback(context.request, url.pathname)) {
      return new Response(null, { status: 404 });
    }

    return new Response(buildGlobalFallbackHtml(url.origin, url.pathname), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Global HTML fallback handler error', error);

    if (!shouldServeHtmlFallback(context.request, url.pathname)) {
      return new Response(null, { status: 404 });
    }

    return new Response(buildGlobalFallbackHtml(url.origin, url.pathname), {
      status: 200,
      headers: responseHeaders,
    });
  }
};
