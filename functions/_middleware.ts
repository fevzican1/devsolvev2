/**
 * Cloudflare Pages middleware — runs BEFORE every Pages Function on matched routes.
 * Blocked bots receive 403 here; `context.next()` is never called, so the heavy
 * /k/[[slug]] HTML generator never executes for them.
 */

import { ACCESS_DENIED_HEADERS, decideAccess, type CfRequestProperties } from './_shared/botGuard';

interface CfRequest extends Request {
  cf?: CfRequestProperties;
}

interface EventContext {
  request: CfRequest;
  next(): Promise<Response>;
}

type PagesFunction = (context: EventContext) => Response | Promise<Response>;

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  if (url.hostname.includes('pages.dev')) {
    return new Response('Siktir Git', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return context.next();
  }

  const ua = context.request.headers.get('user-agent') || '';
  if (decideAccess(ua, context.request.cf) === 'block') {
    return new Response('Access Denied', {
      status: 403,
      headers: ACCESS_DENIED_HEADERS,
    });
  }

  return context.next();
};
