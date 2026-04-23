import { buildSectionFallbackHtml } from '../_shared/sectionFallback';
import {
  CONTENT_SIGNAL_HEADER,
  CONTENT_SIGNAL_VALUE,
} from '../../src/lib/seo/contentSignal';
import { TOOLS_SECTION_METADATA } from '../../src/lib/seo/sectionMetadata';
import { getToolBySlug, toolRegistry } from '../../src/tools/registry';

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

function buildToolsFallbackHtml(siteUrl: string, requestedPath?: string) {
  return buildSectionFallbackHtml(
    {
      canonicalPath: '/tools',
      title: TOOLS_SECTION_METADATA.title,
      description: TOOLS_SECTION_METADATA.description,
      requestedPath,
      featuredLinks: toolRegistry.slice(0, 12).map((tool) => ({
        href: `/tools/${tool.slug}`,
        label: tool.name,
        description: tool.shortDescription,
      })),
    },
    siteUrl,
  );
}

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const slug = url.pathname.split('/').filter(Boolean).slice(1).join('/');

    if (slug && getToolBySlug(slug)) {
      const response = await context.next();
      if (response.status === 200) {
        const headers = new Headers(response.headers);
        headers.set('X-Robots-Tag', responseHeaders['X-Robots-Tag']);
        headers.set(CONTENT_SIGNAL_HEADER, CONTENT_SIGNAL_VALUE);
        return new Response(response.body, {
          status: 200,
          headers,
        });
      }
    }

    return new Response(buildToolsFallbackHtml(url.origin, slug ? `/tools/${slug}` : undefined), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Tools fallback handler error', error);
    const url = new URL(context.request.url);
    return new Response(buildToolsFallbackHtml(url.origin), {
      status: 200,
      headers: responseHeaders,
    });
  }
};
