# DevSolve — Dizin Kararlılığı + Otorite (Backlink Alternatifi) Raporu (2026-06)

**Talep:** "Google ve Bing neden sürekli dizinden düşürüyor, bunu kökten çöz; 18M
sayfayı koru; backlink ekle veya backlink yerine daha gelişmiş alternatif
teknolojiler kullan; en son güncellemeleri bozma; Cloudflare maliyeti artmasın."

Bu doküman; (1) "sürekli dizinden düşme"nin gerçek mühendislik nedenlerini,
(2) bir kod ajanının backlink konusunda **dürüstçe** ne yapıp ne yapamayacağını,
(3) bu turda uygulanan, maliyetsiz ve mevcut mimariyi bozmayan somut
düzeltmeleri, ve (4) Google/Bing aksiyon listesini içerir.

---

## 1) "Sürekli dizinden düşme" — gerçek nedenler

18M kombinatoryal programatik sayfada Google/Bing'in URL'leri dizinde tutmasını
belirleyen üç eksen vardır. Önceki turlar (1) ve (2)'nin büyük kısmını kapattı;
bu tur, **kalıcı çözümün üçüncü ayağı olan (3) otorite/keşif sinyallerini** ele
alır.

| Eksen | Belirti (GSC/Bing) | Durum |
|---|---|---|
| **(1) Erişilebilirlik** | "403 ile engellendi", "Tarandı – dizine eklenmedi" | ✅ Önceki turda kapatıldı (fail-open Googlebot/Bingbot, 410→404, no-store 4xx). Bu tur bunu **bozmadan** genişletti. |
| **(2) Kopya/kalite** | "Kopya — Google farklı canonical seçti", "Soft 404" | ✅ Execution-Context + intent-keyed Worked Example + Layout Asymmetry. Korundu. |
| **(3) Otorite/keşif** | "Bulundu – dizine eklenmedi", indekslenip sonra düşme | ⚠️ **En zayıf halka.** Yeni bir alan adının 18M URL'yi dizinde tutması için **otorite (inbound sinyal) + hızlı keşif** gerekir. Bu turun konusu. |

> **Kritik gerçek:** Düşük otoriteli yeni bir domainde, bir sayfa taranıp
> *geçici* indekslenip sonra "Bulundu/Tarandı – dizine eklenmedi"ye düşebilir.
> Bu "düşme"nin çaresi sayfa sayısını artırmak değil, **domain otoritesini ve
> keşif sinyallerini** güçlendirmektir. Sayfalar zaten 200 dönüyor ve özgün;
> eksik olan **otorite**ydi.

---

## 2) Backlink hakkında dürüst gerçek (ve "gelişmiş alternatif")

Bir kod ajanı **gerçek üçüncü-taraf backlink üretemez** — backlink, başka
sitelerin size *kendi iradeleriyle* link vermesidir; repoya kod yazarak
uydurulamaz (uydurulan/satın alınan linkler Google'ın link-spam politikasını
tetikler ve **dizinden düşmeyi hızlandırır**). Önceki ajan bu yüzden "veremem"
dedi ve **teknik olarak haklıydı.**

Ama "backlink veremem" ≠ "otorite için hiçbir şey yapamam". Repodan
yapılabilecek, Google'ın onayladığı, backlink'in **organik olarak oluşmasını
sağlayan** gelişmiş alternatifler vardır. Bu turda **üçü birden** uygulandı:

1. **Sosyal/link-önizleme botlarını edge'de serbest bırakmak** → her paylaşım
   gerçek bir zengin kart üretir → tıklama/paylaşım/organik inbound link.
2. **Tek bir kalıcı marka varlığı (Organization + WebSite entity, @id ile)** →
   otoritenin 18M dağınık sayfada eriyip gitmesi yerine **tek kimlikte
   birikmesi** (entity SEO / Knowledge Graph uygunluğu).
3. **RSS yayını (syndication feed)** → feed reader/aggregator/otomasyonların
   linkleri yeniden yayınlaması = programatik sitelerin ilk organik
   backlink'lerini elde etme yolu + Google/Bing için "yeni içerik" keşif
   sinyali.

Üçü de **tamamen statik/deterministik**; Cloudflare Function'ı fazladan
tetiklemez, edge-cache bozulmaz, **maliyet artmaz**.

---

## 3) Bu turda uygulananlar (kod, geri-alınabilir)

### 3.1 Sosyal / link-önizleme botları artık 403 yemiyor
`functions/k/[[slug]].ts` + `public/robots.txt`

- **Sorun:** Edge bot-guard "Google + gerçek tarayıcı + Bing/DuckDuckGo dışındaki
  her tanımsız istemciyi 403'le" diyordu. Bu, **link paylaşıldığında kart
  üreten botları** (X/Twitterbot, LinkedInBot, Slackbot, Discordbot,
  TelegramBot, WhatsApp, facebookexternalhit, redditbot, Mastodon, Pinterest,
  Apple'ın **Applebot** arama botu) da kapsıyordu. Sonuç: paylaşılan her /k/
  linki **ölü 403** → kart yok → tıklama/paylaşım/backlink yok.
- **Düzeltme:** `SOCIAL_PREVIEW_MARKERS` allow-list'i eklendi; `decideAccess`
  bu botları **generic block'tan ÖNCE** ALLOW eder. `facebookexternalhit` /
  `facebookbot` blok listesinden çıkarıldı (Meta'nın **AI** crawler'ları
  `meta-externalagent`/`meta-externalfetcher` **bloklu kalıyor**). Apple'ın AI
  eğitim botu `applebot-extended` **özellikle bloklu** kalır; sadece arama botu
  `applebot` serbest.
- **Maliyet:** Bu botlar yalnızca edge-cache'li, ucuz, deterministik sayfayı
  görür → **0 ek Function tetiklenmesi**, sahte-bot saldırı yüzeyi yok.

### 3.2 Tek marka varlığı: Organization + WebSite entity
`src/lib/seo/organization.ts` (yeni) + `functions/k/[[slug]].ts`

- Her sayfa eskiden anonim, sayfa-başına tekrarlanan bir `publisher` nesnesi
  basıyordu. Artık `@graph` içinde **tek bir** `Organization` (`@id` =
  `…/#organization`) ve **tek bir** `WebSite` (`@id` = `…/#website`) düğümü var;
  her `TechArticle` bunlara `publisher`/`isPartOf` ile `@id` üzerinden işaret
  eder. Otorite **dağılmak yerine tek kimlikte birikir.**
- `sameAs` alanı **kasıtlı olarak boş** (şeffaflık): yalnızca site sahibinin
  gerçekten sahip olduğu profiller (GitHub org, X, LinkedIn şirket sayfası)
  eklenince doldurulmalı. Uydurma `sameAs` bir E-E-A-T riskidir. Modül bunu
  `buildOrganizationNode({ siteUrl, sameAs:[…] })` ile destekler.
- Hub sayfası da aynı Organization + WebSite grafiğini yayınlar.

### 3.3 Open Graph / Twitter görsel etiketleri
`functions/k/[[slug]].ts`

- `twitter:card=summary_large_image` vardı ama **görsel etiketi yoktu** → kart
  render olmuyordu. `og:image`, `og:image:alt`, `twitter:image`,
  `twitter:image:alt` eklendi (mevcut statik `opengraph-image.svg` /
  `twitter-image.svg`'ye işaret eder).
  > Not: Facebook/X SVG OG görselini render etmez. Kartların **her** platformda
  > görünmesi için sahibi `public/og-image.png` (1200×630 PNG) ekleyip bu
  > etiketleri ona çevirmeli. Mevcut hâl geçerli metadata'dır ve zarar vermez.

### 3.4 RSS syndication feed
`scripts/generate-feed.mjs` (yeni) + `scripts/postbuild.mjs` + `public/_headers`
+ `public/robots.txt` + her sayfaya `<link rel="alternate" type="application/rss+xml">`

- Build sırasında **statik** `out/feed.xml` üretilir. Slug'ları yeniden
  türetmez; **parity-check'ten geçmiş** `out/sitemap-priority-*.xml`'den okur →
  resolver ile **asla drift edemez** (kitlesel-deindex sınıfı hatadan korunma).
- Feed, Google ve Bing'in kabul ettiği bir "yeni içerik" sitemap formatıdır
  (robots'a `Sitemap: …/feed.xml` eklendi) ve bir syndication kanalıdır.
- En fazla `FEED_MAX_ITEMS` (varsayılan 1000) öğe; statik dosya, edge'den
  sunulur → **0 Function maliyeti.** Hata olsa bile deploy'u bozmaz (best-effort).

---

## 4) Bozulmayan garantiler (regresyon kontrolü)

Yerel render harness (atılabilir) ile doğrulandı — **hepsi PASS**:

- Googlebot, Bingbot, Applebot, **ve tüm yeni sosyal botlar** geçerli bir
  `/k/<slug>` için **200** alıyor; gerçek Chrome tarayıcı **200**.
- `applebot-extended`, `GPTBot`, `python-requests`, `AhrefsBot`, boş-UA → **403**
  (bloklama bozulmadı).
- 200 HTML'de: tek `Organization`, tek `WebSite`, `…/#organization`'a işaret
  eden `publisher`, `og:image`, `twitter:image`, RSS alternate link, ve hâlâ
  **tek** `FAQPage` (schema-conflict yok), doğru `canonical`.
- Bilinmeyen ama şekil-geçerli slug → **404** (kurtarılabilir); şekil-geçersiz
  slug → **410**. Yani 18M gerçek sayfa korunur, yalnızca gerçek çöp 410 alır.
- `slug-parity-check`: **PASS** (sitemap ↔ resolver lockstep; kombinatoryal
  diziler değiştirilmedi, korpüs hâlâ **18.040.320**).
- `npm run typecheck` (app + functions): **temiz**.

---

## 5) Google Search Console + Bing WMT aksiyon listesi

1. **Deploy** sonrası `out/feed.xml`'in canlı olduğunu doğrula:
   `https://devsolvev2.com/feed.xml` → 200 + `application/rss+xml`.
2. **GSC → Site Haritaları:** mevcut `sitemap-index-2026-06-v3.xml`'e ek olarak
   **`feed.xml`'i de gönder** (Google feed'i "yeni içerik" kaynağı olarak ayrı
   bir tarama turunda kullanır). **Bing WMT**'ye de aynısını ekle.
3. **Sosyal kart testi:** birkaç `/k/` URL'sini
   [X Card Validator], [LinkedIn Post Inspector], [Facebook Sharing Debugger]
   ile kontrol et. Artık **403 değil**, kart dönmeli. (SVG OG nedeniyle görsel
   boş gelirse §3.3'teki PNG önerisini uygula.)
4. **Otorite başlangıcı (sahibinin yapması gereken — kod DIŞI):** marka adına
   gerçek profiller aç (GitHub org, X, LinkedIn şirket). URL'lerini
   `buildOrganizationNode`'un `sameAs`'ine ekle (PR ile). Bu, entity
   konsolidasyonunu tamamlar ve ilk gerçek backlink'lerin oluşmasına zemin
   hazırlar. **Asla link satın alma / link çiftliği kullanma** — bu, dizinden
   düşmeyi hızlandırır.
5. **Sabırlı ol:** 18M ölçeğinde dizine ekleme kademelidir. Hedef "az ama
   *kalıcı* indeksli" çekirdeğin büyümesi; bu tur o çekirdeğin **düşmesini**
   önleyen otorite/keşif sinyallerini ekledi.

---

## 6) Sitemap'in 1.3M'e düşmesi — neden ve düzeltme (2026-06)

**Belirti:** Programatik sitemap **~1.300.000 URL / 27 dosya** gösteriyordu,
oysa korpüs 18.040.320. "Sayfalar silindi mi?" sorusu buradan geldi.

**Teşhis:** Sayfalar **silinmedi.** Pages Function hâlâ 18M sayfanın tamamını
200 ile sunuyor. Sorun yalnızca **sitemap üreticisindeydi**:
`generate-programmatic-sitemaps.mjs` içindeki `isQualityEligible()` kapısı,
**Tier 3** (chunk 25+) için her çekirdeğin **162 modifier varyantından yalnızca
ilkini** sitemap'e yazıyordu. Sonuç:

```
Tier 1–2 (chunk 1–24) : tüm modifier'lar      → 1.200.000 URL
Tier 3   (chunk 25+)  : 162'de 1 modifier     → ~104.000 URL
                                         TOPLAM ≈ 1.304.000 URL ≈ 27 dosya
```

`PROGRAMMATIC_SITEMAP_LIMIT` 18.040.320 olsa bile bu kapı sitemap'i ~1.3M'de
tıkıyordu; kalan ~17M sayfa yalnızca iç-link grafiğiyle keşfedilebiliyordu (bu
yüzden "eksik/silinmiş" gibi görünüyordu).

**Düzeltme:** Site sahibinin net kararı üzerine `isQualityEligible()` artık
**her zaman `true`** döner — **tüm 18.040.320 URL** sitemap'e yazılır
(≈ 361 `sitemap-tier{1,2,3}-XXXX.xml` dosyası). Tier sistemi korunur (priority /
changefreq / lastmod ile crawl budget'ı güçlü sayfalara yönlendirir) ama artık
**hiçbir URL'yi sitemap'ten çıkarmaz.**

**Doğrulama:** Sınırlı koşu (limit=1.3M) sonrası Tier-3 dosyalarındaki index'ler
artık **ardışık** (…-1250000, -1250001, -1250002…), yani 162'de 1 değil tüm
modifier'lar yazılıyor. `slug-parity-check`: 300 canlı slug örneği, **0
çözümsüz** → hepsi worker'da 200 döner.

**Dürüst uyarı (maliyet/ölçek):**
- Tam 18M sitemap ≈ **361 dosya / ~5 GB XML** üretir. Cloudflare Pages
  sınırları içinde kalır (dosya başına ~14 MB < 25 MiB; ~376 dosya < 20.000)
  ama **build çıktısı ve deploy yükü büyür.** Statik dosyalardır; Function
  maliyeti **yok**.
- 18M URL'i sitemap'e **yazmak** ≠ Google'ın hepsini **dizine eklemesi**.
  Keşif maksimize edildi; indeksleme yine kalite eşiğini geçen alt kümeyle
  sınırlı kalır. Daha küçük/faz faz sitemap istenirse **kod değişmeden**
  `PROGRAMMATIC_SITEMAP_LIMIT=4000000` gibi bir env ile ayarlanır.

---

## 7) Yapılmayanlar ve neden (dürüstlük)

- **Sahte backlink / link satın alma:** yapılmadı — politika ihlali, dizinden
  düşürür. İstenen sonucun (kalıcı indeksleme) tam tersini üretir.
- **Korpüs küçültme (18M→110k):** yapılmadı — site sahibinin kararı net:
  **18.040.320 korunur.**
- **Görsel üretimi (PNG OG):** otomatik üretilmedi (gereksiz bağımlılık + açık
  talep yok); §3.3'te net talimat bırakıldı.
- **Sitemap-index sürüm artırma:** dokunulmadı — keşif "donması" tekrarlarsa
  mevcut `SITEMAP_INDEX_NAME` mekanizması (recovery raporu §6) kullanılmalı.
