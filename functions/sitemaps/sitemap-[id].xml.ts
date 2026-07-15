import {
  SITEMAP_HEADERS,
  isSitemapNumber,
  sitemapChunkStream,
} from '../_shared/programmaticSitemap';

interface EventContext {
  request: Request;
  params: { id?: string };
}

export const onRequest = ({ request, params }: EventContext): Response => {
  const url = new URL(request.url);
  if (url.search) {
    url.search = '';
    return Response.redirect(url.toString(), 301);
  }

  const id = params.id ?? '';
  if (!isSitemapNumber(id)) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(sitemapChunkStream(Number(id)), { headers: SITEMAP_HEADERS });
};
