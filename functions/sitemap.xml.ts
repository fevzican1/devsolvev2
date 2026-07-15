import {
  SITEMAP_HEADERS,
  sitemapIndexXml,
} from './_shared/programmaticSitemap';

interface EventContext {
  request: Request;
}

export const onRequest = ({ request }: EventContext): Response => {
  const url = new URL(request.url);
  if (url.search) {
    url.search = '';
    return Response.redirect(url.toString(), 301);
  }

  return new Response(sitemapIndexXml(), { headers: SITEMAP_HEADERS });
};
