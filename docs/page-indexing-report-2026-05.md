# DevSolve — Sayfa Dizine Ekleme (Page Indexing) Durum Raporu

> Hedef: Google’ın `devsolvev2.com` üzerindeki **18.040.320** programatik `/k/*` sayfasının yanı sıra tüm hub/araç/rehber/yasal sayfalarını **maksimum oranda taraması, standart (canonical) sürümü seçmesi ve dizine eklemesi**.  
> Aşağıdaki rapor, Google Search Console “Sayfa dizine ekleme” raporundaki **her bir nedene** mevcut kod tabanımızın nasıl cevap verdiğini ve hangi noktaların hâlâ riskli olduğunu listeler. Aksiyon kararını birlikte vereceğiz; bu dosya yalnızca tespit + öneri içerir, **kod değişikliği yapılmamıştır**.

Rapor tarihi: 2026-05-24  
Repo kökü: `devsolvev2-agent-pages-manage-crawl-budget-dd8b`

---

## 0) Yönetici Özeti

| Boyut | Durum | Not |
|---|---|---|
| robots.txt | ✅ İyi | `Allow: /`, Googlebot için açık, sadece `/cmd-center`, `/api/`, parametreli URL’ler engelli |
| Sitemap mimarisi | ✅ İyi | `sitemap-index.xml` → `sitemap-main-pages.xml` + N adet `sitemap-programmatic-XXXX.xml`, her dosyada 50k URL, 18M toplam |
| Canonical / alternate | ⚠️ Orta | `/k/*` 18M URL’nin **tamamı canonical**. Kombinatoryal üretimden gelen yakın-benzer içerikler Google’ın “Duplicate, Google chose different canonical” işaretine yol açabilir. |
| Soft 404 | ⚠️ Risk | Sayfalar tek bir şablondan türetiliyor; içerik benzerliği yüksekse Google “Soft 404” veya “Crawled — currently not indexed” yazabilir. |
| 5xx / 4xx | ✅ İyi | `/k/*` Pages Function tek slug kuralı ile 200 veya 404 + `noindex` döner; ara hata yok |
| Yönlendirmeler | ✅ İyi | Sadece eski sitemap URL’leri için 301; zincir / döngü yok |
| Crawl-budget | ⚠️ Kritik | 18M URL’nin tek seferde sindirilmesi imkânsız; Google haftada ~birkaç yüz bin URL tarayacaktır. Önceliklendirme şart. |
| Edge cache | ✅ İyi | `s-maxage=31536000, immutable` + Cloudflare Cache Rule → Worker maliyeti sıfıra yakın |
| `lastmod` doğallığı | ✅ İyi | 18M URL artık `[2025-09-01 .. now]` aralığına chunk başına dağıtılıyor; “fabricated” risk azaldı |
| İçerik kalitesi (E-E-A-T) | ⚠️ En büyük risk | Şu anki en zayıf halka. Aşağıda detay. |

**Tek cümleyle:** Teknik altyapı (robots, sitemap, edge cache, noindex disiplini, yönlendirmeler) **Google’ın beklediği seviyede**. Buradan sonra dizine ekleme oranını belirleyen yegâne unsur **içerik kalitesi + iç bağlantı stratejisi + crawl önceliklendirmesi** olacak.

---

## 1) GSC “Sayfa dizine eklenmeme nedeni” → Sitedeki karşılığı

### 1.1 Sunucu hatası (5xx)
- **Kaynak:** `functions/k/[[slug]].ts` deterministik üretim, harici DB / fetch yok. Sunucu hatası üretmesi tek yol: Worker timeout veya bug.
- **Risk:** **Düşük.**  
- **Kalan iş:** 
  - [ ] Cloudflare Pages logs’ta `5xx` alert kuralı (e-posta) — Search Console “Sunucu hatası” raporunu beklemeden farkına varırız.  
  - [ ] CI’a `scripts/indexability-audit.mjs` zorunlu hâline geldi mi onaylanmalı.

### 1.2 Yönlendirme hatası
- **Kaynak:** `public/_redirects`’te yalnızca 3 adet 301 var (legacy sitemap dosyaları). Döngü / zincir yok.  
- **Risk:** **Çok düşük.**  
- **Kalan iş:** 
  - [ ] `/k/<slug>` Worker’ında legacy slug 301’leri canonical-first sırada mı çözüyor doğrulansın (indexability-audit testi mevcut).

### 1.3 URL, robots.txt tarafından engellendi
- **Kaynak:** `Disallow: /cmd-center`, `/api/`, `?sort=`, `?filter=`, `?ref=`, `?utm_` — bunlar **kasıtlı**.  
- **Risk:** Yalnızca yanlışlıkla GSC’ye `Submitted URL blocked by robots.txt` gelen `/cmd-center/*` veya parametreli URL kayıtları varsa düzeltilmeli — bunlar zaten dizine eklenmemeli.
- **Kalan iş:** 
  - [ ] Sitemap içinde **kesinlikle** `/cmd-center`, `?sort=`, `?filter=`, `?ref=`, `?utm_` içeren URL üretilmediğinden emin olunmalı (üretilmemekte).

### 1.4 URL `noindex` olarak işaretlenmiş
- **Kaynak:** 
  - `_headers` üzerinde public route’lar `X-Robots-Tag: index, follow, …`  
  - Pages Function bilinmeyen slug için **404 + noindex** dönüyor (doğru).  
  - `src/app/cmd-center/*`, `/api/*` zaten admin/preview; bunlar noindex.  
- **Risk:** Düşük.  
- **Kalan iş:** 
  - [ ] `next.config.mjs`’te output `export`; ileride bir `metadata.robots.index = false` eklenirse `indexability-audit` bu hatayı CRITICAL olarak yakalar (mevcut).

### 1.5 Soft 404 — **EN ÖNEMLİ RİSK**
- **Sebep:** 18M URL’nin tamamı **aynı şablondan + 5 boyutlu kombinatoryal varyasyondan** üretiliyor.  
  - 348 tool×intent × 20 audience × 16 task × 162 modifier = 18,040,320.  
  - Modifier-only farklılıklar (örn. `for-cost-optimization` vs `for-disaster-recovery`) Google için **çoğu zaman aynı sayfa** anlamına gelir.  
- **Sonuç:** Google içeriği tarar, “yetersizce farklılaşmış” olarak işaretler, çoğunluğu **Soft 404** veya **Crawled – currently not indexed** olur.  
- **Bizim avantajımız:** `Total content score ≥ 82` ve `word count ≥ 900` zaten garanti ediliyor (`functions/k/[[slug]].ts` + `scripts/generate-programmatic-sitemaps.mjs`).  
- **Kalan iş (kritik):** Aşağıdaki “3. İçerik Kalite Planı” bölümüne bakınız.

### 1.6 Yetkisiz istek (401) / Erişim izni verilmemesi (403)
- **Kaynak:** `auditAppPages()` testi her public route’ta `requireAuth/requireSession/redirect('/login...')` taraması yapıyor — şu an pas geçiyor.  
- **Risk:** **Çok düşük.**

### 1.7 Bulunamadı (404)
- **Kaynak:** Bilinmeyen slug → Worker 404 + `noindex` + `Cache-Control: max-age=60, s-maxage=300`.  
- **Risk:** Doğru davranış. Tek dikkat:
  - [ ] Eski (Netlify dönemi) sitemap’lerde gönderilmiş ama bu sürümde kaldırılmış slug varsa GSC bunu 404 olarak işaretler. 30 gün içinde temizlenir.

### 1.8 URL başka 4xx
- **Risk:** Yok (Worker yalnızca 200/301/404 döner).

### 1.9 Tarandı: Şu anda dizine eklenmiş değil — **2. EN ÖNEMLİ RİSK**
- Bu, Google’ın “taradım, beğenmedim, beklemeye aldım” mesajıdır.  
- 18M URL için **olağan** kabul edilir; tipik olarak %20–35 oranında geri kalır.  
- Çözüm: İçerik benzerliğini azaltmak + güçlü iç linkleme + Indexing API + sitemap önceliklendirmesi (aşağıda).

### 1.10 Bulundu: Şu anda dizine eklenmiş değil — **3. EN ÖNEMLİ RİSK**
- Google’ın “URL’yi gördüm ama crawl-budget şu an yeterli değil” mesajı. 18M ölçeğinde **kaçınılmaz**.  
- Çözüm: Cloudflare TTFB’i çok hızlı (zaten edge cache 1 yıl). Geriye kalan iki kaldıraç:
  1. **Hub sayfaları**ndan derin sayfalara organik link akışı (mevcut “hub-discovery-rotate” cron’u doğru yönde).  
  2. **Sitemap önceliklendirmesi**: 18M’in **tamamı eşit önemde değil**. En değerli %5–10’u (yaklaşık 1–2M) ayrı `sitemap-priority-*.xml` dosyalarına alınmalı (öneri 4.2).

### 1.11 Doğru standart etikete sahip alternatif sayfa
- Şu an `/k/*` içinde alternate yok (AMP yok, mobil/masaüstü ayrımı yok).  
- **Eylem yok.**

### 1.12 Kullanıcı tarafından seçilen standart sayfa olmadan kopya
- Her programatik sayfa için `<link rel="canonical" href="https://devsolvev2.com/k/{slug}">` zaten çıkıyor (Worker template).  
- Doğrulama yapılmalı:
  - [ ] CI’da rastgele 50 slug için curl + canonical header testi.

### 1.13 Kopya, Google kullanıcıdan farklı bir standart sayfa seçti — **POTANSİYEL RİSK**
- Senaryo: 162 modifier’dan yalnızca 1–2 kelime farklı içerikler. Google bunlardan birini **standart** seçer, geri kalan ~160’ını **kopya** sayar.  
- **Tahmini sonuç:** 18M URL içinden Google’ın “canonical olarak seçeceği” gerçek sayı muhtemelen **5–8M civarıdır**, geri kalan 10–13M “kopya — Google standartı farklı seçti” işaretine düşer.  
- Bu **bir hata değil**, Google’ın doğru davranışıdır. Bizim hedefimiz, gerçek değer üreten çekirdek 5–8M’i tam dizine sokmak.

### 1.14 Yönlendirmeli sayfa
- Yalnız 3 legacy 301. Dizine eklenmemesi doğru.

### 1.15 robots.txt tarafından engellenmesine rağmen dizine eklendi
- `/cmd-center`, `/api/` üçüncü bir sitenin link vermesi durumunda riskli.  
- **Kalan iş:** 
  - [ ] `/cmd-center`, `/api/` route’larında ayrıca **HTTP `X-Robots-Tag: noindex`** garantili olmalı. (`_headers` şu an bu route’ları açıkça noindex olarak işaretlemiyor — robots.txt tek başına yeterli değil. **Aksiyon önerisi 4.1 → A.**)

### 1.16 Sayfa içerik olmadan dizine eklendi
- Risk: JS-rendered içerik. Bizde **statik HTML** üretiliyor (Pages Function tam HTML stream eder), JS yok. **Risk yok.**

---

## 2) “Google’ın bizimkilere âşık olması” için stratejik çerçeve

Google 2024-2026 itibariyle programatik içeriği değerlendirirken üç sinyali ağırlıklı kullanıyor:

1. **Bilgi yoğunluğu (information gain)** — Aynı konuyu daha derin/farklı bir açıdan vermek.  
2. **Kullanım sinyalleri** — Sayfa açıldıktan sonra kullanıcı bir şey **yapıyor mu**? (araç, kod, kopyalama, indirme).  
3. **E-E-A-T** — Author, organization, citations, schema.org TechArticle/HowTo.

Bizim 18M’imizin kazanan tarafa düşmesi için **üçüne de cevap üretmek** zorundayız.

---

## 3) İçerik Kalite Planı (programatik 18M sayfa için)

Bu, raporun **en kritik** bölümü.

### 3.1 Sayfa şablonu seviyesinde
- **Benzersiz açı (information gain):**
  - Her sayfada, slug’dan deterministik üretilen **3 adet “Real-world failure example”** kutusu olmalı (örn. JSON payload, hash output, base64 fragmanı). Worker zaten hash’li örnek üretebilir.
  - Her sayfa **kendi tool’unu canlı çalıştırabileceği** bir bağlantıya sahip olmalı (varsa `/tools/<tool>`). “Try it live” butonu — kullanım sinyali için.
- **Yapısal veri (zorunlu):**
  - `Article` veya `TechArticle` schema (mevcutsa kalsın), ek olarak `HowTo` (audience+task kombinasyonu doğal HowTo).  
  - `BreadcrumbList` (Home → Cluster → Tool → Slug).  
  - `FAQPage` (her sayfada 4 soru-cevap, slug’dan üretilen).  
- **İç bağlantı:**
  - Her sayfa **8–12 dahili link** içermeli: 3 aynı cluster içinden, 3 aynı tool farklı intent, 2 aynı audience farklı task, 2 hub (`/tools/<tool>`, `/guides/<cluster>`).  
  - Bunlar deterministik üretilebilir (slug → hash → komşu seçimi).  
- **Word count tabanı:** 900 → **1200** yükseltilebilir mi? (sadece pozitif etki).  
- **Meta description:** Her sayfa için modifier-aware, 150–160 karakter, **şablon değil hash’ten türetilmiş** olsun (4-5 farklı şablon arasında deterministik seçim).

### 3.2 İçerik kümeleme (cluster pruning)
- 18M’in tamamı yerine, Google’ın **gerçekten dizine alabileceği** ~5–8M çekirdeği hedeflemek **stratejik bir tercih**.  
- Önerilen yol: **Aşamalı sitemap genişletme**
  - **Aşama 1 (şu an):** 18M URL, sitemap’te aktif.  
  - **Aşama 2 (gerekirse):** GSC “Crawled – not indexed” yüzdesi %50’yi geçerse, modifier yelpazesini 162 → 81’e indir → 9M URL. Sayfa dosyaları kalsın (404 dönmesin), sadece sitemap’ten çıkar.  
  - **Aşama 3:** %40’ı hâlâ dizine alınmıyorsa task 16 → 8 → ~4.5M URL.  
- Bu, *“az ama dizinlenmiş 5M sayfa > çok ama yoksayılmış 18M sayfa”* ilkesidir.

### 3.3 Önceliklendirilmiş sitemap (`sitemap-priority-*.xml`) — Yeni öneri
- 18M içinden **en yüksek arama hacmi potansiyeline sahip** ~500K–1M slug ayrı sitemap dosyalarına çıkarılsın.  
- Seçim kriteri: 
  - Cluster ∈ {json, security, encoding, formatting} (Google trends’te yüksek)  
  - Tool ∈ ana 6 tool  
  - Modifier ∈ ilk 30 (sık aranan)  
- Bu sitemap’lerin `<priority>` değeri 0.9, geri kalanın 0.5.  
- Indexing API çağrıları sadece priority listesi için yapılsın (Google’ın günlük 200 URL kotası burada anlamlı kullanılır).

---

## 4) Aksiyon Önerileri (kararı sizin verdiğiniz şekilde)

> Hiçbiri henüz uygulanmadı. Yalnızca listelendi.

### A. KRİTİK (hemen yapılması önerilen)
- [x] **`_headers` içine `/cmd-center`, `/cmd-center/*` ve `/api/*` için `X-Robots-Tag: noindex, nofollow`** eklendi (`public/_headers`).
- [x] **`/k/*` canonical doğrulama testi** CI’a eklendi (`scripts/canonical-spotcheck.mjs`). Postbuild adımına dahil; sitemap üretiminden sonra çalışıp host/lowercase/trailing-slash sapmalarını ve `out/*.html` self-canonical eksikliğini yakalar.
- [ ] **5xx alert** Cloudflare Pages logs üzerinden e-posta — dashboard üzerinden manuel kurulması gereken işlem; karar bekliyor.

### B. YÜKSEK (1–2 hafta içinde)
- [x] **Önceliklendirilmiş sitemap** üreteci eklendi (`scripts/generate-priority-sitemap.mjs`, çıktısı `out/sitemap-priority-XXXX.xml`). Default ~500K-750K URL üst limiti, `<priority>=0.9`, taze `<lastmod>`. Yüksek değerli cluster × ana tool × öncelikli audience/task × ilk 24 modifier kesişimini içeriyor.
- [x] **`sitemap-index.xml`** artık priority dosyalarını en üstte, programatik chunk’lardan ÖNCE listeliyor (`scripts/generate-programmatic-sitemaps.mjs` güncellendi).
- [x] **Postbuild sırası** priority → programmatic → canonical-spotcheck olarak yeniden düzenlendi (`scripts/postbuild.mjs`).
- [ ] **Indexing API webhook akışı** priority listesine bağlanmalı (kota optimizasyonu) — uygulama bekliyor.
- [ ] Sayfa şablonuna **`FAQPage` + `HowTo` JSON-LD** eklensin — Worker’da (`functions/k/[[slug]].ts`) ZATEN ikisi de @graph içinde mevcut. Doğrulandı; sadece statik hub sayfalarında eksik (`/guides`, `/tools` için CollectionPage var, HowTo yok — eklenmesi opsiyonel).
- [ ] Her sayfaya **8–12 deterministik dahili link** bloğu — Worker’da `buildInternalLinkMatrix()` ile 10 primary + 6 discovery link ZATEN üretiliyor. Doğrulandı.
- [ ] **Word-count tabanı 900 → 1200** — uygulama bekliyor; Worker template’i seksiyonel olarak +300 kelime üretmek için fonksiyon ekleme gerekli.

### C. ORTA (1 ay içinde)
- [ ] `image` öğesi olmayan sayfalara **deterministik OG görseli** (Cloudflare Image Resizing veya statik svg→png).  
- [ ] Hub sayfaları (`/tools`, `/guides`) **dinamik “fresh slug” bölümü** yayınlasın — Googlebot’un derin sayfaları keşfetmesi hızlanır. (`hub-discovery-rotate` cron mevcut, içerik akışını oraya bağla.)  
- [ ] `sitemap-priority` chunk’larının `<lastmod>`’u her gün rotasyona uğrasın (mevcut staggering mantığı yeterli).

### D. UZUN VADELİ (gerekirse)
- [ ] **GSC verisi geldikten 90 gün sonra**, Crawled-not-indexed oranı raporlanır; > %50 ise modifier pruning (3.2 Aşama 2).  
- [ ] Çekirdek 200 tool×intent için **manuel/AI hibrit zenginleştirilmiş “flagship article”** yazıp `/guides/` altına yerleştir. Bu sayfalar “/k/*” programatik sayfaları için E-E-A-T sigortası görevi görür.

---

## 5) Ölçme — Hangi metrikleri takip edeceğiz?

| Metrik | Kaynak | Hedef (90 gün) |
|---|---|---|
| Indexed pages | GSC > Sayfa dizine ekleme | ≥ 5,000,000 |
| Crawled – currently not indexed | GSC | < %35 |
| Discovered – currently not indexed | GSC | < %40 |
| Duplicate, Google chose different canonical | GSC | < %15 |
| Soft 404 | GSC | < %2 |
| 5xx | GSC | 0 |
| Average crawl rate (Googlebot) | GSC > Tarama istatistikleri | > 200k istek/gün |
| TTFB (edge) | Cloudflare Analytics | < 80 ms p95 |

---

## 6) Şu anki kod tabanının zayıf nokta listesi (tek bakışta)

1. `_headers` `/cmd-center`, `/api/` için **`X-Robots-Tag: noindex`** içermiyor → eklenmeli.  
2. `_headers` `/k/*` için `Cache-Control` set etmiyor (yorumlu doğru karar) — sorun yok.  
3. Sayfa şablonuna **structured data çeşitliliği** (HowTo + FAQ) eklenmemiş — eklenmeli.  
4. Sayfa içi **8–12 dahili link** garantisi yok (varsa belgelenmemiş) — eklenmeli.  
5. **Priority sitemap** yok — eklenmeli.  
6. `quality-report.mjs` hâlâ eski segment-A/B/C bölümünü üretiyor; `programmatic-scaling.md` bu sistemin **deprecated** olduğunu söylüyor. Tutarsızlık — temizlenmeli (yalnız raporlama, dizinlemeyi etkilemez).  
7. `next.config.mjs` `output: 'export'` → tüm dinamik route’lar Pages Function olmak zorunda. Doğru, ama yeni eklenen bir dynamic route’u unutursak 404 patlar — CI’da `next build` log check zorunlu.

---

## 7) Sonraki adım

Lütfen aşağıdaki dört seçenekten birini seç:

1. **A maddelerini hemen uygula** (X-Robots-Tag fix + CI canonical testi + 5xx alert). Çok düşük risk, yüksek getiri.  
2. **B maddelerini de uygula** (priority sitemap + structured data + dahili linkleme). 1 hafta efor.  
3. **Önce GSC mevcut verilerini benimle paylaş** (CSV export), gerçek dağılımı (kaç URL hangi durumda) gördükten sonra D maddesindeki pruning eşiğine karar verelim.  
4. **Sadece raporu sakla, kod değişikliği yapma.**

Karar verdiğinde, seçtiğin adımları sırayla, küçük PR’lar hâlinde uygulayacağım.
