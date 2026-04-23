const BOT_USER_AGENT_PATTERN =
  /facebookexternalhit|facebot|linkedinbot|slackbot|twitterbot|discordbot|whatsapp|telegram|crawler|spider|preview/i;

const NON_PAGE_PREFIXES = ['/_next/', '/assets/', '/api/'];

function hasStaticFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split('/').pop() ?? '';
  return /\.[a-z0-9]+$/i.test(lastSegment);
}

export function shouldServeHtmlFallback(request: Request, pathname: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false;
  }

  if (NON_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (hasStaticFileExtension(pathname)) {
    return false;
  }

  const secFetchDest = request.headers.get('sec-fetch-dest') ?? '';
  if (secFetchDest === 'document') {
    return true;
  }

  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html') || accept.includes('application/xhtml+xml')) {
    return true;
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  return BOT_USER_AGENT_PATTERN.test(userAgent);
}
