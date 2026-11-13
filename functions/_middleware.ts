/**
 * Crawl Budget / Cache Reserve Middleware (Cloudflare Pages Functions)
 * - Sadece GET istekleri işlenir; diğer metotlar origin'e proxy'lenir.
 * - HTML yanıtları STREAMING modda küçültülür (await response.text() KULLANILMAZ).
 * - Set-Cookie silinerek Cloudflare "BYPASS" engellenir ve Cache Reserve'e uygun hale getirilir.
 * - robots.txt özel olarak önbelleğe alınır ve botlar için erişilebilir tutulur (küçültülmez).
 * - CSS/JS/JSON/img gibi varlıklar değiştirilmeden geçirilir.
 *
 * Bu dosya Pages Functions _middleware'dır: tüm rotalar üzerinde çalışır.
 * Cache Reserve'i etkinleştirmek için Cloudflare panelinden kural eklenmelidir;
 * bu middleware zaten uygun Cache-Control başlıkları gönderir (ek maliyet yoktur).
 */

class HTMLMinifyTransformStream implements Transformer<string, string> {
  private buffer = "";
  private readonly KEEP = 128;

  transform(chunk: string, controller: TransformStreamDefaultController<string>) {
    this.buffer += chunk;

    let processable = "";
    if (this.buffer.length > this.KEEP) {
      const cut = this.buffer.length - this.KEEP;
      processable = this.buffer.slice(0, cut);
      this.buffer = this.buffer.slice(cut);
    }

    if (processable) {
      controller.enqueue(minifyHTML(processable));
    }
  }

  flush(controller: TransformStreamDefaultController<string>) {
    if (this.buffer) {
      controller.enqueue(minifyHTML(this.buffer));
      this.buffer = "";
    }
  }
}

function minifyHTML(html: string): string {
  return html
    // Standart HTML yorumlarını kaldır (multi-line güvenli).
    // <!--[if ...]> koşullu yorumları bozmamak için ön eki hariç tutulur.
    .replace(/<!--(?!<!\[)[\s\S]*?-->/g, "")
    // Tek başına yeni satır/tab karakterlerini boşluğa çevir.
    .replace(/[\n\r\t]/g, " ")
    // 2+ ardışık boşluğu tek boşluğa indir.
    .replace(/\s{2,}/g, " ")
    // Etiketler arındaki boşluğu kaldır: > <  ->  ><
    .replace(/>\s+</g, "><");
}

interface PagesContext {
  request: Request;
  next(): Promise<Response>;
  waitUntil(promise: Promise<unknown>): void;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // 0. Doğrudan devsolvev2.pages.dev adresine gelen tüm bot ve kaçak
  //    istekleri anında kes — production tek tekil hostname: devsolvev2.com
  if (url.hostname === "devsolvev2.pages.dev" || url.hostname.endsWith(".devsolvev2.pages.dev")) {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 0.5. Bing botları kod seviyesinde tamamen engellenir (site politikası: sadece Google).
  const ua = request.headers.get("user-agent") || "";
  if (/bingbot|msnbot|adidxbot/i.test(ua)) {
    return new Response("Forbidden — Bing crawling disabled by site policy", { status: 403 });
  }

  // 0. GET dışındaki tüm metotları origin'e açık geç (değişiklik yapma).
  if (request.method !== "GET") {
    return fetch(request);
  }

  // 1. Origin'den yanıtı al. Gövde henüz okunmuyor => streaming başlangıcı.
  let response = await fetch(request);

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const setCookie = response.headers.get("set-cookie");

  // Teşhis: cf-cache-status BYPASS ise ve Set-Cookie varsa logla.
  const cacheStatus = response.headers.get("cf-cache-status") || "UNKNOWN";
  if (cacheStatus === "BYPASS" && setCookie) {
    console.warn(`[CACHE BYPASS] URL: ${url.pathname} | Sebebi: Set-Cookie mevcut`);
  }

  // 2. robots.txt: botların erişebilmesi ve önbelleklenebilmesi için özel işlem.
  //    İçerik zaten küçük/metin olduğu için küçültülmez.
  if (pathname === "/robots.txt") {
    const headers = new Headers(response.headers);
    headers.delete("set-cookie");
    headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // 3. Sadece HTML yanıtları akış içerisinde küçültülür ve önbelleğe zorlanır.
  if (contentType.includes("text/html") && response.body) {
    const headers = new Headers(response.headers);

    // Çerezleri kaldır ki Cloudflare "BYPASS" yapmasın; Cache Reserve uygun hale gelsin.
    headers.delete("set-cookie");

    // Edge + Cache Reserve için uzun ömürlü önbellek talimatı.
    // max-age = 1 yıl, stale-while-revalidate = 1 gün.
    headers.set("cache-control", "public, max-age=31536000, stale-while-revalidate=86400");

    // STREAMING zinciri: Bayt -> Metin -> Küçültme -> Bayt (response.text() yok)
    const minifiedStream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TransformStream(new HTMLMinifyTransformStream()))
      .pipeThrough(new TextEncoderStream());

    return new Response(minifiedStream, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // 4. Diğer GET yanıtları (CSS, JS, JSON, resim, XML vb.):
  //    Hiçbir şekilde okunmadan/minimize edilmeden origin'den geçirilir.
  return response;
};
