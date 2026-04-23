import { buildSectionFallbackHtml } from '../_shared/sectionFallback';
import { shouldServeHtmlFallback } from '../_shared/requestRouting';
import {
  CONTENT_SIGNAL_HEADER,
  CONTENT_SIGNAL_VALUE,
} from '../../src/lib/seo/contentSignal';
import { GUIDES_SECTION_METADATA } from '../../src/lib/seo/sectionMetadata';
import { guideRegistry } from '../../src/content/guides';

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

function buildGuidesFallbackHtml(siteUrl: string, requestedPath?: string) {
  return buildSectionFallbackHtml(
    {
      canonicalPath: '/guides',
      title: GUIDES_SECTION_METADATA.title,
      description: GUIDES_SECTION_METADATA.description,
      requestedPath,
      featuredLinks: guideRegistry.slice(0, 12).map((guide) => ({
        href: `/guides/${guide.slug}`,
        label: guide.title,
        description: guide.description,
      })),
    },
    siteUrl,
  );
}

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const slug = url.pathname.split('/').filter(Boolean).slice(1).join('/');
    const shouldServeFallback = shouldServeHtmlFallback(context.request, url.pathname);
    const response = await context.next();

    if (!shouldServeFallback) {
      return response;
    }

    if (response.ok) {
      const headers = new Headers(response.headers);
      const contentType = headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        headers.set('X-Robots-Tag', responseHeaders['X-Robots-Tag']);
        headers.set(CONTENT_SIGNAL_HEADER, CONTENT_SIGNAL_VALUE);
      }

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return new Response(buildGuidesFallbackHtml(url.origin, slug ? `/guides/${slug}` : undefined), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Guides fallback handler error', error);
    const url = new URL(context.request.url);
    if (!shouldServeHtmlFallback(context.request, url.pathname)) {
      return new Response(null, { status: 404 });
    }
    return new Response(buildGuidesFallbackHtml(url.origin), {
      status: 200,
      headers: responseHeaders,
    });
  }
};
