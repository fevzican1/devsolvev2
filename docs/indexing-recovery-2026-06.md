# DevSolve — Dizine Ekleme Çöküşü Kriz & Kurtarma Raporu

> **Durum:** Dizine eklenmiş sayfa sayısı **~100.000 → 8**'e düştü (felaket seviyesi deindexing).
> **Bağlam:** Yakın zamanda site saldırıya uğradı; "botlar fonksiyonu tetiklemesin" diye bir **güvenlik sertleştirme (hardening) güncellemesi** yapıldı (`functions/k/[[slug]].ts` içindeki `decideAccess` bot-guard + agresif `410 Gone` mantığı).
> **Amaç:** Güvenlik güncellemesini **BOZMADAN**, Google'ın bizi yeniden taraması ve dizine eklemesini sağlamak.
> Rapor tarihi: 2026-06-01 · Repo: `devsolvev2-agent-pages-manage-crawl-budget-dd8b`

---

## 0) TL;DR — Tek paragraf

Teknik SEO altyapısı (robots, sitemap, canonical, edge cache, lastmod) sağlam. Çöküşün sebebi **içerik kalitesi değil, erişim katmanı**: saldırı sonrası eklenen `functions/k/[[slug]].ts` sertleştirmesi, **yeni bir deploy ile 1 yıllık edge cache'i sıfırladı** ve artık her `/k/*` isteği soğuk (cold) olarak Worker'a düşüp **bot-guard (403)** ve **agresif 410 Gone** kapılarından geçiyor. Daha önce indekslenmiş URL kümesinin büyük kısmı, bu kapılarda ya `403 Access Denied` ya da `410 Gone + noindex` aldığı için Google bunları **bilinçli olarak indeksten düşürdü**. İki yüksek olasılıklı mekanizma var (aşağıda sıralı). Çözüm: bot-guard'ı **"fail-open for Google"** yapmak, 410'u 404'e indirip ölçmek ve önce **küçük bir doğrulama kümesiyle** Google'a "geri döndük" sinyali vermek.

---

## 1) Kök neden analizi — olasılığa göre sıralı

### 🥇 #1 — Bot-guard + cache purge kombinasyonu (EN YÜKSEK OLASILIK)

**Mekanizma:**
1. Saldırı sonrası hardening commit'i deploy edildi → Cloudflare **`/k/*` edge cache'i tamamen purge oldu** (yeni Function sürümü = yeni cache). `programmatic-scaling.md`'de yazdığı gibi normalde sayfalar 1 yıl `immutable` cache'te yaşıyor ve Worker hiç çalışmıyordu. Deploy sonrası **her sayfa yeniden soğudu**.
2. Artık Googlebot'un her isteği `onRequest` → `decideAccess(ua, cf)` kapısından geçiyor.
3. `decideAccess` içinde Googlebot iddiası varsa `isNetworkVerifiedGoogle(cf)` çağrılıyor. Bu fonksiyon:
   ```ts
   if (typeof cf.asn === 'number') {
     if (GOOGLE_ASNS.has(cf.asn)) return true;
     return false;          // ← Google ASN değilse KESİN BLOK
   }
   ```
   `cf.asn` **bir sayı ama 15169/396982 değilse** sonuç `false` → **403 Access Denied**.

**Risk noktası:** Googlebot normalde AS15169'dan gelir, dolayısıyla teoride geçmeli. Ancak:
- Cloudflare **Pages Functions** üzerinde `request.cf` alanlarının (özellikle `asn`) güvenilirliği plana ve route'a göre değişir; cache/preview/edge senaryolarında `asn` beklenmedik bir değere düşebilir.
- 403 cevabı **`Cache-Control: public, max-age=86400`** ile **24 saat edge'de cache'leniyor**. Yani Googlebot bir kez yanlışlıkla 403 alırsa, o URL için **yanlış 403 bir gün boyunca** servis edilir → hata kendini büyütür (self-amplifying).
- `verifiedBotCategory` ve `botManagement.verifiedBot` yalnızca **ücretli Bot Management** planında dolu gelir; ücretsiz/standart planda `false`/`undefined` olur, yani tek güvencemiz ASN/asOrganization eşleşmesi kalır.

**Sonuç:** Daha önce indekslenmiş 100k URL'nin yeniden taranması sırasında bir kısmı 403 aldı; Google "erişim engellendi/blocked" olarak işaretleyip düşürdü.

---

### 🥈 #2 — Agresif `410 Gone` fırtınası (ÇOK YÜKSEK OLASILIK)

**Mekanizma:** Hardening commit'i, eski "her slug için 200 OK sentezle" davranışını kaldırdı (`synthesizePageForArbitrarySlug` artık **çağrılmıyor**, ölü kod). Yeni davranış:
- slug > 220 karakter → **410 + noindex**
- strict regex (`^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$`) tutmazsa → **410 + noindex**
- `resolvePageForRequest(slug)` çözemezse → **410 + noindex**

Daha önce Google'ın indekslediği 100k URL'nin **çoğu muhtemelen sentezlenmiş / legacy / kombinatoryal evrenin dışındaki slug'lardı** (çünkü eski kod *her şeye* 200 dönüyordu, Google de ne bulduysa indeksledi). Yeni kod bunların hepsine **`410 Gone + noindex`** veriyor — bu, Google'a "**bu URL'yi kalıcı olarak sil**" demektir. Google de itaatkârca sildi. Geriye yalnızca strict kombinatoryal evrene **birebir** uyan ve henüz yeniden taranmamış/önbellekte kalan ~8 URL kaldı.

> **Kritik nüans:** Kodun yorumları 410'u "soft-404 / scaled-content'i temizlemek için doğru" diye savunuyor. Mantık doğru ama **zamanlama felaket**: bu temizlik, *trafik getiren, halihazırda indekslenmiş* korpusa toptan uygulandı. 410 + noindex, 404'ten çok daha hızlı ve kalıcı siler.

---

### 🥉 #3 — `.pages.dev` / 500 / 403 cevaplarının cache'lenmesi (DESTEKLEYİCI FAKTÖR)

- `403` (`Access Denied` ve `Siktir Git`) → 24h cache.
- `410` → 24h cache.
- Bu agresif negatif-cache, yanlış bir kararın **bütün gün** tekrar servis edilmesine yol açıyor; hata penceresi 24 saate kilitleniyor.

---

### ❌ Elenen ihtimaller (kontrol edildi, sorun DEĞİL)

| Olası neden | Kontrol | Sonuç |
|---|---|---|
| robots.txt tüm siteyi engelliyor | `public/robots.txt` Googlebot `Allow: /` | ✅ Temiz |
| 200 OK sayfalar `noindex` yolluyor | Function 200 → `index, follow` | ✅ Temiz |
| Sitemap ↔ Function index drift | `buildSlug` sırası (cluster-intent-audience-task-tool-index) iki tarafta **aynı**; `toolIntentPairs` ve PER_PAIR çözümü sitemap döngü sırasıyla **birebir** | ✅ Drift YOK |
| Redirect zinciri/döngüsü | `_redirects` yalnız 3 legacy 301 | ✅ Temiz |
| JS-render içerik | Function tam statik HTML stream ediyor | ✅ Temiz |

> **Not:** Sitemap dosya adı `sitemap-tier{1,2,3}-XXXX.xml`'e geçmiş; `_headers` içindeki genel `/sitemap-*.xml` kuralı bunları kapsıyor. Yine de `sitemap-programmatic-*` ve `sitemap-priority-*` özel kuralları artık üretilmeyen adları hedefliyor — temizlenebilir (kozmetik, indekslemeyi etkilemez).

---

## 2) Hızlı teşhis (kod değiştirmeden, 30 dakika)

Bu adımlar #1 mi #2 mi baskın onu **kesinleştirir**:

1. **GSC → Sayfa dizine ekleme raporu**'nda yeni biriken nedenleri oku. Beklenti:
   - Çok sayıda **"Bulunamadı (404)" / "Yumuşak 404"** → #2 (410 fırtınası) baskın.
   - Çok sayıda **"Engellendi" / "Erişim izni verilmemesi (403)" / "robots dışı bloklama"** → #1 (bot-guard) baskın.
2. **GSC → URL Denetimi → Canlı test** (5–10 bilinen-iyi kombinatoryal slug için). Cevap:
   - `Bloklandı / getirilemedi` → bot-guard Googlebot'u 403'lüyor (**#1 kesinleşti**).
   - `410/404` → 410 mantığı geçerli slug'a yanlış uygulanıyor (**#2 kesinleşti**).
3. **Terminalden Googlebot taklidi** (gerçek Googlebot ASN'inden gelmediğin için bu sadece UA kapısını test eder):
   ```bash
   # Geçerli bir kombinatoryal slug ile:
   curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
     "https://devsolvev2.com/k/json-validate-json-backend-engineer-debug-production-issue-json-formatter-0"
   # Beklenti: HTTP/2 200 + X-Robots-Tag: index, follow
   # 403 görürsen → bot-guard ASN kapısı lokal cf olmadan bile UA'yı reddediyor demek değil;
   #   prod'da cf.asn != 15169 olursa block olur. Asıl test GSC Canlı Test.
   ```
4. **GSC → Tarama istatistikleri (Crawl stats)** → "Yanıta göre" kır. `403`, `410`, `404` oranlarındaki ani sıçrama doğrudan suçluyu gösterir.
5. **Cloudflare → Pages → Functions logs / Analytics** → son 7 günde `/k/*` için 403/410 sayısının patladığı an = deploy anı ile çakışmalı.

---

## 3) Çözüm planı — Güvenliği BOZMADAN (aşamalı)

> İlke: **"Bilinen kötü botları engellemeye devam et, ama Google ve gerçek kullanıcılar için ASLA yanlış-pozitif üretme (fail-open)."** Ayrıca indekslenmiş korpusu silen 410'u, "ölç ve sonra karar ver" anlamına gelen yumuşak bir duruma çek.

### 🔴 FAZ A — ACİL (bugün, en yüksek getiri / en düşük risk)

#### A1. Bot-guard'ı Google için "fail-open" yap — ASN bilinmiyorsa ASLA blokla
`functions/k/[[slug]].ts` → `isNetworkVerifiedGoogle`'daki **"ASN sayı ama Google değil → false"** dalı, Google UA'lı isteklerde tehlikeli. Google UA + (doğrulanamayan ağ) durumunu **engellemek yerine geçir**. Spoof riskini ASN ile değil, **403'ü cache'lememe** + rate-limit ile yönet.

```ts
// ÖNCE (riskli): cf.asn sayıysa ve Google değilse kesin blok
if (typeof cf.asn === 'number') {
  if (GOOGLE_ASNS.has(cf.asn)) return true;
  return false;                 // ← bu satır Googlebot'u yanlışlıkla blokluyor olabilir
}

// SONRA (güvenli): yalnızca KESİN spoof'u blokla, belirsizi geçir
if (cf.verifiedBotCategory && /search/i.test(cf.verifiedBotCategory)) return true;
if (cf.botManagement?.verifiedBot === true) return true;
if (typeof cf.asn === 'number' && GOOGLE_ASNS.has(cf.asn)) return true;
if (cf.asOrganization && /google/i.test(cf.asOrganization)) return true;
return null;   // ← "doğrulayamadım" → çağıran taraf Google UA'yı GEÇİRSİN
```
`decideAccess` zaten `verified === false ? 'block' : 'allow'` mantığında; `null` döndürünce Google UA **geçer**. Böylece spoof bir saldırgan Googlebot UA'sı ile geçebilir AMA bu sadece **deterministik, cache'lenen, hafif** bir sayfa üretir (asıl saldırı yüzeyi değil) — kabul edilebilir takas.

#### A2. Negatif cevapları (403/410/404) cache'leme veya çok kısalt
Yanlış bir 403/410'un 24 saat kilitlenmesini engelle:
```ts
// 403 bot-guard ve pages.dev cevaplarında:
'Cache-Control': 'no-store',          // ÖNCE: public, max-age=86400
// 410/404 cevaplarında:
'Cache-Control': 'public, max-age=60, s-maxage=300',   // 24h yerine 5 dk
```
Böylece bir kararı düzeltir düzeltmez Google bir sonraki taramada doğru cevabı görür.

#### A3. `410 Gone` → geçici olarak `404 Not Found`'a indir (silme sinyalini durdur)
410 + noindex "kalıcı sil" demek; kriz anında bunu istemiyoruz. Çözülemeyen slug'lara **404** dön (Google daha yavaş ve daha bağışlayıcı düşürür, geri dönüş kolay). Korpus toparlanınca, yalnızca **gerçekten ölü** legacy slug'lara tekrar 410 verilebilir.
```ts
status: 404,   // ÖNCE: 410 — şekil-geçersiz ve çözülemeyen slug'lar için
'X-Robots-Tag': 'noindex, follow',
'Cache-Control': 'public, max-age=60, s-maxage=300',
```

#### A4. Bilinen-iyi 200 cevabını doğrula ve cache'i ısıt
A1–A3 deploy edilince, **20–50 yüksek değerli kombinatoryal slug** için `curl`/Canlı Test ile `200` teyit et; bu URL'leri GSC URL Denetimi'nden **"Dizine eklenmesini iste"** ile elle gönder (günde ~10–12 elle istek kotası). Bu, Google'a "site geri döndü" sinyalinin en hızlı yolu.

---

### 🟠 FAZ B — 1–2 HAFTA (toparlanmayı hızlandır)

- **B1. Priority sitemap'i küçük ve taze tut:** `generate-priority-sitemap.mjs` çıktısını ilk etapta **yalnızca ~5.000–10.000 en güçlü URL** ile sınırla, `lastmod = now`, `priority = 1.0`. Google'ın küçük, net bir kümeyi tam indekslemesi, 18M'i eşit dağıtmaktan kat kat hızlıdır. Korpus geri geldikçe genişlet.
- **B2. `sitemap-index.xml`'i ping'le:** GSC → Sitemaps'ten `sitemap-index.xml` ve priority sitemap'leri yeniden gönder (resubmit). `lastmod` taze olduğu için Google tier-1'i öncelikli tarar.
- **B3. 5xx/403 alarmı:** Cloudflare Pages → Notifications → `/k/*` için 403/5xx oranı eşiği aşınca e-posta. Bir daha "100k→8"i günlerce fark etmeden yaşamayalım.
- **B4. Drift guard (CI):** `functions/k/[[slug]].ts` ile `generate-programmatic-sitemaps.mjs`'teki `clusters/audiences/tasks/modifiers` dizilerinin **byte-identik** olduğunu doğrulayan bir test ekle. (Şu an eşitler; ama gelecekte birinin değişip diğerinin kalması, sessizce tüm korpusu 410'a düşürür — gerçek bir zaman bombası.)
- **B5. `synthesizePageForArbitrarySlug` ölü kodunu kaldır** veya bilinçli olarak yorumla — kafa karışıklığını ve yanlış "geri açma" riskini önler.

---

### 🟡 FAZ C — 1 AY (kalite & E-E-A-T derinleştirme)

- **C1. Word-count tabanını 900 → 1200**'e çıkar (Function template'ine seksiyonel +300 kelime fonksiyonu).
- **C2. Yapısal veri çeşitliliği:** Hub sayfalarına (`/tools`, `/guides`) eksik `HowTo` JSON-LD ekle (`/k/*` zaten `@graph`'ta FAQ+HowTo içeriyor).
- **C3. İç linkleme doğrulaması:** `buildInternalLinkMatrix()` her sayfada 10+6 link üretiyor — CI'da rastgele 50 sayfada **en az 8 dahili link** ve **kırık link yok** testi.
- **C4. Modifier benzerliğini azalt:** 162 modifier'ın çoğu Google için "aynı sayfa". `inspect-encoded-payload` örneğindeki gibi yakın-kopya riskini düşürmek için modifier'a bağlı **gerçekten farklı içerik bloğu** (deterministik hash'li örnek payload, farklı FAQ) üret.

---

### 🟢 FAZ D — UÇ / "NIRVANA" FİKİRLER (Google'ı uçuracak kaldıraçlar)

> Bunlar 18M kombinatoryal sayfayı "tolere edilen" değil "aranan" tarafa taşıyan stratejik hamleler.

1. **"Live tool" kullanım sinyali enjeksiyonu (information gain'in kralı):** Her `/k/*` sayfasına, ilgili aracın **gerçekten çalışan** mini bir gömülü versiyonunu koy (zaten "Runs locally in your browser"). Kullanıcı sayfada *bir şey yapınca* (encode/decode/format), bu Google'ın #1 programatik-kalite sinyali olan **davranışsal etkileşim**i üretir. Statik metinden çıkıp "araç sayfası" olmak, soft-404 riskini kökten bitirir.
2. **Çekirdek 200 "flagship" rehber → programatik korpusa otorite akışı:** json/security/encoding/formatting cluster'ları için 200 adet **insan+AI hibrit, gerçekten derin** makale yaz, `/guides/` altına koy, oradan ilgili `/k/*` kümesine link ver. Bu 200 sayfa, 18M'in E-E-A-T sigortası ve PageRank kaynağı olur.
3. **Aşamalı korpus açılışı (drip indexing):** 18M'i bir kerede sunma. Sitemap'i **haftada +250k URL** açacak şekilde rampala. Google küçük taze kümeleri tam indeksleyip "bu site sürekli kaliteli içerik üretiyor" güveni geliştirir; toptan 18M ise "scaled content" alarmını tetikler.
4. **Tier-1 freshness motoru:** Tier-1 (~200k) sitemap'in `lastmod`'unu **günlük gerçek küçük değişikliklerle** (yeni örnek payload, güncel istatistik) döndür. "Gerçekten güncellenen site" sinyali crawl-budget'ı katlar.
5. **Entity/Knowledge-graph bağlama:** Her tool için `sameAs` ile Wikipedia/Wikidata/MDN/RFC bağlantıları (`html-entity` → WHATWG HTML spec, `jwt` → RFC 7519, `base64` → RFC 4648). Bu, sayfaları bilinen *varlıklara* (entity) demirler ve kalite skorunu yükseltir.
6. **"Crawl budget sniper" — log tabanlı önceliklendirme:** Cloudflare logs'tan Googlebot'un **gerçekten istediği** URL'leri çıkar, bunları `hub-discovery-priority-sync` ile priority listesinin başına al. Google neyi istiyorsa onu en taze ve en linkli yap.
7. **404/410 yerine "akıllı en-yakın-canonical 301":** Çözülemeyen ama şekilce geçerli bir slug geldiğinde, hash ile **en yakın gerçek kombinatoryal sayfaya 301** ver (silmek yerine PageRank'i koru). Yalnızca tamamen anlamsız (gibberish) olanlara 404.

---

## 4) GSC "Sayfa dizine eklenmeme nedeni" → Kodumuz → Aksiyon (tam eşleme)

| GSC Nedeni | Şu anki kod davranışı | Risk | Aksiyon |
|---|---|---|---|
| **Sunucu hatası (5xx)** | `catch` → 500 + `no-store` | Düşük | B3 alarmı kur |
| **Yönlendirme hatası** | Yalnız 3 legacy 301 + case-insensitive 301 | Çok düşük | — |
| **robots.txt ile engellendi** | `/cmd-center`,`/api/`,param'lı URL'ler kasıtlı | Düşük | Sitemap'te bu URL'ler yok (teyit edildi) |
| **`noindex` ile işaretlendi** | 200→index; 404/410→noindex; admin→noindex | Doğru | A3: 410'u 404'e indir |
| **Soft 404** | Strict slug + 410; sentez kaldırıldı | Orta | C1/C4 + Live tool (D1) |
| **401/403 ile engellendi** | **bot-guard 403** | 🔴 **YÜKSEK** | **A1 + A2 (acil)** |
| **Bulunamadı (404)** | Çözülemeyen slug → şu an 410 | 🔴 **YÜKSEK** | **A3: 404'e indir, cache kısalt** |
| **Diğer 4xx** | Yalnız 200/301/404/410/500 döner | Yok | — |
| **Tarandı – şu an indekslenmedi** | 18M ölçeğinde normal | Orta | B1 priority + D3 drip |
| **Bulundu – şu an indekslenmedi** | Crawl-budget | Orta | B1 + D4 + D6 |
| **Doğru canonical'lı alternatif** | `/k/*` alternate yok | Yok | — |
| **Kopya – kullanıcı canonical yok** | Her sayfa self-canonical | Düşük | A4 spot-check |
| **Kopya – Google farklı canonical seçti** | 162 modifier yakın-kopya | Orta | C4 + D1 |
| **Yönlendirmeli sayfa** | Legacy 301 | Doğru | — |
| **robots'a rağmen indekslendi** | `_headers` cmd-center/api → noindex | Düşük | — |
| **İçerik olmadan indekslendi** | Tam statik HTML | Yok | — |

---

## 5) Ölçüm — 90 günlük hedefler

| Metrik | Kaynak | Hedef |
|---|---|---|
| Indexed pages | GSC | 8 → **≥ 50.000** (30 gün) → **≥ 1M** (90 gün) |
| 403 / 410 (Crawl stats) | GSC + Cloudflare | A fazından sonra **≈ 0** (geçerli slug'larda) |
| Soft 404 | GSC | < %2 |
| Crawled – not indexed | GSC | < %35 |
| TTFB (edge) | Cloudflare | < 80 ms p95 |
| Googlebot istek/gün | GSC Crawl stats | toparlanmada **artış trendi** |

---

## 6) Yapılacaklar checklist (sıralı)

- [ ] **Teşhis (Faz 2):** GSC neden dağılımı + URL Denetimi Canlı Test + Crawl stats yanıt kırılımı → #1 mi #2 mi kesinleştir
- [ ] **A1:** `isNetworkVerifiedGoogle` → Google için fail-open (ASN bilinmiyorsa null)
- [ ] **A2:** 403/410/404 cevaplarında `no-store` / kısa cache
- [ ] **A3:** Çözülemeyen slug → 410 yerine **404**
- [ ] **A4:** 20–50 bilinen-iyi slug doğrula + GSC'den elle "Dizine eklenmesini iste"
- [ ] **B1:** Priority sitemap'i ~5–10k taze URL'e daralt, resubmit
- [ ] **B3:** Cloudflare 403/5xx alarmı
- [ ] **B4:** CI drift-guard (Function ↔ sitemap dizileri)
- [ ] **C1–C4 / D1–D7:** kalite + nirvana hamleleri

> **Önemli:** A1–A3 güvenlik güncellemesini **bozmaz** — kötü botlar hâlâ `BLOCKED_BOT_PATTERNS` + non-browser bloğu ile engellenir; sadece **Google ve gerçek kullanıcılar için yanlış-pozitif riski** ortadan kalkar ve **silme (410) sinyali geçici olarak askıya alınır**. Hangi adımları uygulamamı istediğini söyle; küçük, geri-alınabilir commit'ler hâlinde uygularım.
