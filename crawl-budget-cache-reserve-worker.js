/**
 * Crawl Budget / Cache Reserve Worker
 * - Sadece GET istekleri işlenir; diğer metotlar (POST, PUT, DELETE...) origin'e Proxy'lenir.
 * - HTML yanıtları STREAMING modda küçültülür (await response.text() KULLANILMAZ).
 * - Set-Cookie silinerek Cloudflare "BYPASS" engellenir ve Cache Reserve'e uygun hale getirilir.
 * - robots.txt özel olarak önbelleğe alınır ve botlar için erişilebilir tutulur (küçültülmez).
 * - CSS/JS/JSON/img gibi varlıklar değiştirilmeden geçirilir.
 *
 * Cache Reserve'i etkinleştirmek için Cloudflare panelinden kural eklenmelidir;
 * bu Worker zaten uygun Cache-Control başlıkları gönderir (ek Maliyet yoktur).
 */

class HTMLMinifyTransformStream {
  constructor() {
    this.buffer = "";
    // Chunk sınırında kopabilir desenler (HTML yorumu, "> <" vb.) için küçük kenar-buyruk.
    this.KEEP = 128;
  }

  transform(chunk, controller) {
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

  flush(controller) {
    if (this.buffer) {
      controller.enqueue(minifyHTML(this.buffer));
      this.buffer = "";
    }
  }
}

function minifyHTML(html) {
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.toLowerCase();

    // 0. GET dışındaki tüm metotları origin'e açık geç (değişiklik yapma).
    if (request.method !== "GET") {
      return fetch(request);
    }

    // 1. Origin'den yanıtı al. Gövde henüz okunmuyor => streaming başlangıcı.
    let response = await fetch(request);

    const cacheStatus = response.headers.get("cf-cache-status") || "UNKNOWN";
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const setCookie = response.headers.get("set-cookie");

    // Teşhis: BYPASS oluyorsa ve Set-Cookie varsa logla.
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
        .pipeThrough(new HTMLMinifyTransformStream())
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
  },
};
