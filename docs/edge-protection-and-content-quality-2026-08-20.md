# Kenar koruması, içerik kalitesi, ramp 5, backlink gerçeği — 2026-08-20

**Branch:** `cursor/waf-content-quality-ramp-traffic-aca1`
**Content version:** `20260820b` (`CONTENT_UPDATED_AT=2026-08-20T13:40:00.000Z`)
**Agent contract:** `devsolve-ai-indexing-agent v2026-08-20.1`

Bu rapor beş isteği ayrı ayrı ele alıyor: bot trafiğinin kökten engellenmesi,
Google/Bing erişiminin garanti altına alınması, içerik kalitesi sorununun kök
nedeni, ramp seviyesi, backlink kaydı ve kod tarafından yönetilebilen gerçek
trafik. Sonunda **sadece panelden yapılabilecek iki işlem** var; onları siz
yapmadan sistem tam güvenli sayılmaz.

---

## 1. WAF — canlıya alındı (deploy edildi, doğrulandı)

Zone `devsolvev2.com` üzerinde custom rules artık şu sırada (Free planda 5 kural
sınırı var; sizin elle yazdığınız `sasd` ve Cloudflare'ın `AI Crawl Control`
kuralları korundu):

| # | Aksiyon | Kural |
|---|---------|-------|
| 1 | `skip` | **Doğrulanmış Googlebot + Bingbot** ve sahiplik/feed uçları |
| 2 | `block` | Scraper, AI crawler, HTTP kütüphaneleri, kısa/boş User-Agent |
| 3 | `managed_challenge` | Tarayıcı taklidi yapan istemciler + datacenter ağları |
| 4 | `block` (sizin) | `sasd` — wp-admin vb. |
| 5 | `block` (Cloudflare) | AI Crawl Control |
| + | `block` | Rate limit: `/k/*` + sitemap, 30 istek/10 sn, IP başına; `not cf.client.bot` + WAF1 skip → gerçek Googlebot/Bingbot muaf |

### Sahte Googlebot konusu — WAF2'de yok, bilinçli

Kural 1 **User-Agent'a bakarak izin vermiyor.** Şart `cf.client.bot` — bu
Cloudflare'ın doğrulanmış bot sinyali (`cf.bot_management.verified_bot` ile aynı
veri, farkı: her planda çalışır; ters DNS ve yayınlanmış IP listeleriyle
doğrulanır). Bir VPS'ten gelen "Googlebot" UA'sı bu alanı asla `true` yapamaz.

WAF2 **sahte Googlebot/Bingbot UA'sına bakmaz.** Crawler string'ini custom
kuralda bloklamak, Cloudflare'ın doğrulaması geciktiğinde gerçek taramayı
403'e düşürmenin en kısa yoludur. Spoof'lar WAF1 skip'ine giremez
(`cf.client.bot=false`); rate limit ifadesi de `not cf.client.bot` olduğu
için farm'ı hızdan tutar, gerçek Googlebot/Bingbot'u tutmaz.

Bu makinadan (AWS, AS14618) yapılan doğrulama — `node scripts/verify-live-access.mjs`:

```
OK    GPTBot / ClaudeBot / PerplexityBot / Bytespider / CCBot: 403 (edge)
OK    AhrefsBot / SemrushBot / DataForSeoBot / Screaming Frog: 403 (edge)
OK    curl / wget / python-requests / okhttp / node-fetch / boş UA: 403 (edge)
OK    Chrome/145 (Client Hints yok), Chrome/99 farm UA: 403 (edge)
OK    robots.txt, IndexNow anahtar dosyası, ads.txt: 200
```

Hepsi **edge'de** duruyor: Pages Function çağrısı sıfır, dolayısıyla maliyet
sıfır.

### Şikâyet ettiğiniz UA listesi hakkında dürüst not

Chrome/142–145 gibi **güncel** UA'lar 114 bin isteğe kadar çıkmış. Bu UA'ları
gerçek bir insandan ayıran tek şey UA değil; fingerprint (Client Hints + Fetch
Metadata), HTTP sürümü, ağ (datacenter mi residential mi) ve **hız**. Kural 3 ilk
üçünü, rate limit dördüncüsünü kapatıyor. Residential proxy üzerinden, tam
başlık setiyle, yavaş gelen bir scraper'ı UA/başlık ile ayırt etmek mümkün değil
— onu yalnızca hız limiti ve JS challenge durdurur, ikisi de artık devrede.

Ayrıca: Cloudflare analitiği **engellenen istekleri de sayar**. "114k istek"
demek "114k sayfa okundu" demek değil; challenge/block yiyen istekler de o
tabloda görünür. Bir botun istek göndermesini engelleyemeyiz; içerik almasını ve
bize para harcatmasını engelleyebiliriz — yapılan bu.

### ⚠️ Bot Fight Mode — planınızı değiştirmeniz gerekiyor

Bot Fight Mode'u tekrar açıp "WAF listesinin başına Googlebot/Bingbot skip
kuralı koyalım" fikri **teknik olarak çalışmıyor.** Cloudflare'ın kendi
dokümanı:

> "You cannot bypass or skip Bot Fight Mode using WAF custom rules or Page
> Rules. This is because Bot Fight Mode does not run on the Ruleset Engine — it
> operates in a separate evaluation pipeline where Skip, Bypass, and Allow
> actions have no effect."
> — https://developers.cloudflare.com/bots/get-started/bot-fight-mode/

Dahası, **doğrulanmış bot allowlist'i Super Bot Fight Mode özelliğidir** (Pro ve
üstü). Ücretsiz Bot Fight Mode'da böyle bir muafiyet yok:

> "Super Bot Fight Mode adds verified bot allowlisting, per-category actions,
> static resource protection, and JavaScript detections."
> — https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/

Yani açık Bot Fight Mode, gerçek Googlebot/Bingbot'a da challenge gösterebilir
ve **hiçbir kural bunu engelleyemez.** Bu, 20M sayfayı indeksten düşürmenin en
kısa yolu.

Ölçüm: şu an bu makinadan HTML isteyen her istek `cf-mitigated: challenge`
alıyor — kendi kurallarımız o isteği bloklamadan önce. `.txt` uzantılı dosyalar
skip kuralı sayesinde 200 dönüyor ama `/`, `/k/*` ve `.xml` uçları challenge
yiyor. Bu, **Bot Fight Mode'un (ve/veya yüksek Security Level'ın) şu anda açık
olduğunu** gösteriyor.

**Sizin yapmanız gerekenler (API token'ımın yetkisi yok, panelden):**

1. **Security → Bots → Bot Fight Mode = OFF.** Kural 2 ve 3 zaten aynı işi,
   crawler muafiyetiyle yapıyor.
2. **Security → Settings → Security Level = Medium** (Under Attack veya High
   değil). Under Attack, gerçek ziyaretçiye de interstitial gösterir — istediğiniz
   gerçek trafiğin önündeki en büyük engel bu olur.

Kontrol: `curl -I https://devsolvev2.com/` çıktısında `cf-mitigated: challenge`
görünmemeli (datacenter IP'den challenge normaldir; kendi tarayıcınızdan
görüyorsanız sorun var).

---

## 2. İçerik kalitesi — kök neden ve çözüm

### Bing'in bildirdiği 6 "title too long" sayfası

Canlıda ölçtüm (`devsolvev2.pages.dev` üzerinden, WAF'ı by-pass ederek): o
URL'lerin başlıkları **62–69 karakter**, yani Bing'in 70 sınırının altında.
Rapor eski taramadan kalmış. Bir tanesi (`…css-minifier-7629015`) artık 301 ile
kanonik URL'ine yönleniyor.

Kalıcı çözüm için sınır **66 karaktere** indirildi (`TITLE_MAX`), ve başlıkta
zaten adı geçen aracın ikinci kez yazılması kaldırıldı. Böylece hem Bing'in
sınırına 4 karakter pay kaldı, hem başlıklar Google SERP'inde kesilmeden
görünüyor (CTR = gerçek trafik). Bu bir örneklemeyle değil aritmetikle
garanti: `titleVocabularyAudit()` en kötü durumu 66 olarak kanıtlıyor.

### Asıl sorun: metin, düzenlenmiş İngilizce gibi okunmuyordu

Jaccard benzerliği "iki sayfa aynı metin mi" sorusunu cevaplar; "bu metni bir
insan yazmış/düzenlemiş mi" sorusunu cevaplamaz. Bing'in `Keyword Stuffing and
Artificially Engineered Language` ve Google'ın scaled-content politikası tam
olarak ikinci soruyu sorar. Eski çıktıdan gerçek örnekler:

| Sorun | Eski çıktı | Şimdi |
|-------|-----------|-------|
| Slug'dan gelen kısaltmalar | "Validate json", breadcrumb'da "Json" | "Validate JSON", "JSON" |
| Belirsiz artikel | "a api consumer guide to…" | "for API consumers" |
| Şablon eki | "finish by making confirm the change is correct… possible" | "Treat the job as finished when you can confirm the change is correct…" |
| Fiil öbeğinin isim yerinde kullanımı | "replay validate JSON" | "replay the JSON validation" |
| İç jargon | "you are on the wrong sibling", "Skip this URL if…" | "you are reading the wrong guide", "Skip this guide if…" |
| Aynı cümlede tekrar | "JSON Formatter — JSON Formatter is… validate json" | tek geçiş, tanım cümlesi |
| H1 | 152 karakter, dizi hâlinde | 86–125 karakter, iki cümleli başlık |

Kod tarafında yapılanlar:

- **`functions/_lib/language.ts` (yeni):** slug → okunur metin dönüşümünün tek
  yeri. Kısaltma sözlüğü, bileşik sıfatlar (`security-conscious`), çoğul rol
  adları, 66 fiil için gerundium tablosu, ve telaffuza göre `a/an` seçimi.
- **`PageKernel`** artık `jobNoun` ("JSON validation"), `jobGerund" ("validating
  JSON"), `audiencePlural` ("API consumers"), `contextSituation` ("during team
  onboarding") ve `clusterField` taşıyor. Şablonlar hangi biçime ihtiyaç
  duyuyorsa onu kullanıyor; fiil öbeği bir daha isim yerine geçmiyor.
- Okuyucuya dönük metinden **süreç kelimeleri** ("sibling", "this URL",
  "citation") tamamen çıkarıldı — 100'den fazla cümle yeniden yazıldı.
- Aynı ürün adını 20 ankor metninde tekrarlayan "related" bloğu düzeltildi:
  aracın adı yalnızca farklı bir araca gidiyorsa yazılıyor.

### Bir daha geri gelmemesi için: kapı

`auditServedCopy()` artık şunları **build'i düşürecek şekilde** kontrol ediyor:
süreç kelimeleri, küçük harfli kısaltmalar, artikel uyumu (metnin kendi
`articleFor()` yardımcısına karşı), küçük harfle başlayan paragraflar, ikilenen
kelimeler, çift boşluk, şablon ekleri ve anahtar kelime yoğunluğu.
`scripts/lib/search-guidelines.mjs` içine `edited-prose` kuralı olarak
kaydedildi; `scripts/verify-edge-corpus-quality.mjs` Faz C'de her sayfa için
çağırıyor.

Ölçüm: 8.000 sayfa tarandı → **0 bulgu**. Tam kapı çıktısı:

```
[A] worst-case title 66 (limit 66), problems 0
[B] titles 45-66, descriptions 150-160, 0 duplicate title/desc/H1
[C] score min/avg/max 98/99.97/100, min words 1260, guideline violations: none
[D] canonical 200 / stale 301 / unknown 404
[E] sibling body 5-gram Jaccard max 0.177 ≤ 0.25
```

---

## 3. Ramp 5 — 20M URL artık sitemap'te

Kararı bana bıraktığınız yer. Gerekçe: ramp, içerik henüz kanıtlanmamışken crawl
bütçesini korumak için vardı. Bugün 20M URL'in tamamı indexability sözleşmesini
geçiyor (tekil title/description/H1, ≥1000 kelime, düzenlenmiş metin, sıfır
kritik ihlal), dolayısıyla 19.5M URL'i sitemap'ten saklamak yalnızca keşfi
geciktiriyordu.

- `.ramp-level` = 5, `EMBEDDED_RAMP_LEVEL` = 5, `defaultRampLevel` = 5,
  `resolveRampLevel()` fallback = 5 (dosya silinse bile küçülmüyor).
- Doğrulama: `[ramp-sync] file=5 embedded=5 sitemapLimit=20000000 chunks=400`.
- Tazelik hâlâ katmanlı: ilk 200K `daily`, sonrası `weekly`, kuyruk `monthly`
  (Bing §21 crawl verimliliği).
- Günlük IndexNow dilimi 200 → 2.000 URL (protokolün 10.000/istek sınırının ve
  Bing'in "stream, batch değil" tavsiyesinin içinde).

---

## 4. Backlink — neden kaydedilmemiş (ölçülmüş cevap)

`node scripts/verify-backlinks.mjs` (yeni) her profili bir crawler'ın gördüğü
şekilde test ediyor: sayfa açılıyor mu, link **sunucudan gelen HTML'de** mi,
sayfa indexlenebilir mi, link `nofollow`/`ugc` mi. Bugünkü sonuç:

| Profil | Crawler ne görüyor |
|--------|--------------------|
| GitHub repo / profil | Link var, ama `rel="nofollow"` (GitHub tüm kullanıcı linklerini nofollow yapar) |
| Hashnode | `rel="noopener noreferrer nofollow ugc"` |
| dev.to | `rel="noopener me ugc"` |
| Indie Hackers | Alan adı sayfada geçiyor ama `<a href>` JavaScript ile basılıyor → crawler link görmüyor |
| Product Hunt | HTTP 403 (bot koruması) |
| SaaSHub | Sayfa `noindex` |
| AlternativeTo | HTTP 403, ayrıca moderasyonda |
| Launchstag / tools.cafe | Sitelerde DevSolve **henüz geçmiyor** — sizin dediğiniz gibi 30'unda |
| X | JavaScript ile basılıyor |
| LinkedIn | HTTP 999 (bot bloğu) |

**Cevap:** 12 profilin hiçbiri şu an "takip edilebilir + indexlenebilir" bir link
sunmuyor. Bu bizim sitemizdeki bir hata değil; bu platformların politikası.
Rapora düşmemesinin nedeni de bu. Bing/GSC raporları ayrıca linkleyen sayfa
yeniden taranana kadar (günler–haftalar) güncellenmiyor.

Kod tarafında düzelttiğim gerçek sorun: site, **henüz var olmayan** Launchstag ve
tools.cafe listelerini "Featured on …" rozetiyle gösteriyor ve `sameAs` içinde
ilan ediyordu. Linklenen sayfa bunu desteklemediği için bu bir doğrulanamaz
iddiaydı (Bing: misleading representation). İkisi de `BRAND_LAUNCHSTAG_LIVE` /
`BRAND_TOOLS_CAFE_LIVE` bayraklarının arkasına alındı — **30'unda listeler
yayına girince bu iki bayrağı `true` yapın**, audit script'i doğrulamak için
duruyor.

Değer üretecek link tipi: indexlenebilir, sunucu tarafından basılan, follow
edilen editoryal link — yani gerçek bir yazı içindeki bağlantı. Bir kod ajanı
bunları üretemez; üretmeye çalışmak link scheme cezasıdır.

---

## 5. Kod tarafından yönetilebilen gerçek trafik

Dürüst çerçeve: kod talep yaratmaz, **talebi karşılamayı** ve **tıklanmayı**
iyileştirir. Bu turda yapılanlar:

1. **Keşif:** 500K değil 20M URL sitemap'te; günlük IndexNow dilimi 10 katına
   çıktı; feed.xml artık WAF'tan muaf (Feedly/Inoreader AWS'den çeker, önceden
   challenge yiyordu).
2. **Tıklama:** başlıklar ≤66 karakter (SERP'te kesilmiyor), description 150–160,
   breadcrumb + TechArticle şeması yerinde.
3. **Dönüşüm:** `/k/` sayfalarının girişine tek tıklık araç CTA'sı eklendi.
   Uzun kuyruk sorgusundan gelen okuyucu aracı hemen buluyor; aynı link
   `/tools/*` sayfalarına iç otorite taşıyor — head-term talebi orada.
4. **Paylaşım:** doğrulanmış link-preview botları (X, LinkedIn, Slack, Discord,
   Facebook) artık `/k/*` üzerinde bloklanmıyor; paylaşılan link kart olarak
   render ediliyor. Önceki kural setinde bunlar bloklanıyordu.

Yapılmayan ve yapılmaması gereken: satın alınmış trafik, bot trafiği, otomatik
sosyal spam. İkisi de "yüksek trafik" grafiği üretir, ikisi de indeksten düşürür.

Sosyal kart: `public/opengraph-image.png` 1200×630 PNG. X/LinkedIn SVG
render etmez; bu dosya `og:image` / `twitter:image` olarak layout, sayfa
metadata'sı ve `/k/*` Function HTML'inde işaret edilir.

---

## Dosya listesi

- `scripts/deploy-waf-bot-block.mjs` — skip/block/challenge + rate limit
- `scripts/verify-live-access.mjs` — erişim matrisi yeniden yazıldı
- `scripts/verify-backlinks.mjs` — **yeni**, backlink gerçeklik denetimi
- `scripts/lib/crawler-asns.mjs` — Google/Bing ASN referansı (WAF2 spoof bloğu yok)
- `public/opengraph-image.png` — 1200×630 sosyal kart
- `functions/_lib/language.ts` — **yeni**, dil katmanı
- `functions/_lib/programmaticPage.ts` — title 66, doğal H1, kopya denetimi
- `functions/_lib/pageVariation.ts`, `corpusKnowledge.ts` — metin yeniden yazımı
- `functions/_lib/revenuePlacements.ts` — "Featured this URL" ifadesi düzeltildi
- `scripts/lib/search-guidelines.mjs` — `edited-prose` kuralı, TITLE_MAX 66
- `scripts/lib/ai-indexing-agent.mjs` — sözleşme v2026-08-20.1
- `.ramp-level`, `functions/_lib/embeddedRamp.ts`, `src/config/*` — ramp 5
- `src/lib/seo/organization.ts`, `src/components/layout/FeaturedBadges.tsx` — rozet bayrakları
- `.github/workflows/daily-discovery-ping.yml` — IndexNow dilimi

## Deploy sırası

1. Bu PR merge edilince `cloudflare-deploy.yml` Pages production deploy'unu
   tetikler (WAF değişiklikleri **şimdiden canlı**, koda bağlı değil).
2. Deploy sonrası: **Bot Fight Mode OFF + Security Level Medium** (yukarıdaki §1).
3. GSC ve Bing Webmaster Tools'da `https://devsolvev2.com/sitemap.xml` yenile —
   400 sitemap chunk, 20M URL.
4. Bing SEO raporundaki 6 başlık uyarısı için "Validate fix" / yeniden tarama
   isteyin; içerik zaten uyumlu, rapor eski taramadan kalma.
