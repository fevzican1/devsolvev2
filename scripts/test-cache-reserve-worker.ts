/**
 * Yerel test: Crawl Budget / Cache Reserve middleware
 * Cloudflare ortamı yok olduğu için fetch ve PagesContext mock'lanır.
 * Test senaryoları:
 *  1. GET text/html + Set-Cookie => set-cookie silinmeli, cache-control zorlanmalı, streaming akış döner
 *  2. GET /robots.txt => set-cookie silinmeli, cache-control 86400, küçültülmez
 *  3. POST /PUT/DELETE => origin'e passthrough (fetch as-is çağrılır)
 *  4. GET css/js/json/img => değiştirilmeden geçirilir
 *  5. Streaming: response.body bir ReadableStream olmalı, metin bellekte birikmez
 */

import { onRequest } from '../functions/_middleware';

const originHtml = `
<!doctype html>
<html>
  <head><title>Test</title></head>
  <body>
    <!-- comment to remove -->
    <h1>   Merhaba   Dünya   </h1>
    <p>Satır
sona</p>
  </body>
</html>
`;

const originCss = "body { color: red; }";

let fetchCalls: { method: string; url: string }[] = [];
const originalFetch = globalThis.fetch;

async function mockFetch(input: RequestInfo, init?: RequestInit) {
  const req = typeof input === 'string' ? new Request(input) : input;
  fetchCalls.push({ method: req.method, url: req.url });
  const url = new URL(req.url);
  const isHtml = url.pathname === '/page.html';
  const isRobots = url.pathname === '/robots.txt';
  const isCss = url.pathname === '/style.css';

  if (isHtml) {
    return new Response(originHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': 'session=abc123; Path=/',
        'cf-cache-status': 'BYPASS',
      },
    });
  }
  if (isRobots) {
    return new Response("User-agent: *\nDisallow: /private/\n", {
      status: 200,
      headers: {
        'content-type': 'text/plain',
        'set-cookie': 'tracking=xyz; Path=/',
        'cf-cache-status': 'BYPASS',
      },
    });
  }
  if (isCss) {
    return new Response(originCss, {
      status: 200,
      headers: { 'content-type': 'text/css' },
    });
  }
  return new Response('not found', { status: 404 });
}

function makeContext(req: Request) {
  return {
    request: req,
    next: async () => mockFetch(req),
    waitUntil: (p: Promise<unknown>) => p,
  };
}

async function collectStream(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(typeof value === 'string' ? new TextEncoder().encode(value) : value);
  }
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function run() {
  // Global fetch'i mock'la
  (globalThis as any).fetch = mockFetch;

  let pass = 0, fail = 0;
  function check(name: string, cond: boolean) {
    if (cond) { pass++; console.log(`PASS: ${name}`); }
    else { fail++; console.error(`FAIL: ${name}`); }
  }

  // 1. GET HTML
  {
    const ctx = makeContext(new Request('https://example.com/page.html', { method: 'GET' }));
    const res = await onRequest(ctx as any);
    const body = await collectStream(res.body as ReadableStream);
    const text = new TextDecoder().decode(body);

    check('HTML status 200', res.status === 200);
    check('HTML set-cookie removed', !res.headers.has('set-cookie'));
    check('HTML cache-control set', res.headers.get('cache-control') === 'public, max-age=31536000, stale-while-revalidate=86400');
    check('HTML comments removed', !text.includes('<!-- comment to remove -->'));
    check('HTML whitespace collapsed', !text.includes('   Merhaba   '));
    check('HTML > < removed', !text.includes('> <'));
    check('HTML body is stream', res.body instanceof ReadableStream);
    check('HTML minified output contains title', text.includes('<title>Test</title>'));
  }

  // 2. GET /robots.txt
  {
    const ctx = makeContext(new Request('https://example.com/robots.txt', { method: 'GET' }));
    const res = await onRequest(ctx as any);
    const body = await collectStream(res.body as ReadableStream);
    const text = new TextDecoder().decode(body);

    check('Robots status 200', res.status === 200);
    check('Robots set-cookie removed', !res.headers.has('set-cookie'));
    check('Robots cache-control 86400', res.headers.get('cache-control') === 'public, max-age=86400, stale-while-revalidate=604800');
    check('Robots not minified (newlines kept)', text.includes('\n'));
    check('Robots body is stream', res.body instanceof ReadableStream);
  }

  // 3. POST passthrough
  {
    const ctx = makeContext(new Request('https://example.com/page.html', { method: 'POST', body: 'x=1' }));
    const res = await onRequest(ctx as any);
    check('POST fetch called once', fetchCalls.filter(c => c.method === 'POST').length === 1);
    check('POST status passthrough', res.status === 404 || res.status === 200);
  }

  // 4. GET css passthrough unchanged
  {
    const ctx = makeContext(new Request('https://example.com/style.css', { method: 'GET' }));
    const res = await onRequest(ctx as any);
    const body = await collectStream(res.body as ReadableStream);
    const text = new TextDecoder().decode(body);

    check('CSS unchanged', text === originCss);
    check('CSS content-type kept', res.headers.get('content-type') === 'text/css');
  }

  console.log(`\nSonuç: ${pass} başarılı, ${fail} başarısız`);

  // Gerçek fetch'i geri yükle
  (globalThis as any).fetch = originalFetch;

  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
