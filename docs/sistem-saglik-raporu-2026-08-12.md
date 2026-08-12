# DevSolve Sistem Sağlık & İndeksleme Raporu

**Tarih:** 2026-08-12  
**Site:** https://devsolvev2.com  
**Zone:** `devsolvev2.com` (Free plan, active)  
**Ramp:** Level **0** (sitemap’te **500.000** URL; corpus **20.000.000** URL edge’de 200 ile servis edilir)  
**Kaynaklar:** Canlı Cloudflare API (WAF entrypoint), kod tabanı, edge probe, kullanıcı GSC gözlemi

---

## Yönetici özeti (doğrudan cevaplar)

| Soru | Kısa cevap |
|------|------------|
| 20M sayfanın **tamamı** Google/Bing’de indekslenir mi? | **Teknik olarak indexable (evet)**; **hepsi birden indekslenmez (hayır)**. Şu an sitemap yalnızca **500K** duyuruyor. Tam corpus ramp 5’e çıkmadan “20M indexed” beklenmez. |
| Cloudflare Function sürekli tetikleniyor / maliyet yaratıyor mu? | **Tasarım: hayır (agresif maliyet yok).** Function yalnızca `/k/*` + sitemap path’lerinde ve **cache MISS**’te çalışır. WAF engeli Function’a **hiç uğratmaz**. HIT = $0 invocation. |
| Backlink’ler otomatik kazanılacak mı? / Ben bir şey yapmadan olur mu? | **Hayır.** Kod üçüncü taraf backlink üretemez. Verdiğin **4 backlink** faydalı başlangıç; otorite için ek white-hat listing/ içerik paylaşımı gerekir. |
| Google taramaları artacak mı? Tekrar ~50K bulur mu? | **Artış mümkün**, otomatik garanti yok. Under Attack kapalı + son 24h başarılı crawl iyi sinyal. 50K/gün crawl **otorite + indeks oranı + ramp** ile gelir; günler–haftalar içinde dalgalanır. |
| Under Attack kapalı — sistem sağlıklı mı? | **WAF/cache mimarisi sağlıklı.** Datacenter IP’lerden `cf-mitigated: challenge` görülebilir (Bot Fight / managed challenge); **doğrulanmış Googlebot/Bingbot Rule 0 ile skip** — senin “son 24 tarama başarılı” gözlemiyle uyumlu. |
| Google Vertex 8 OK / 8 FAIL | Beklenen. `Google-Extended` **robots.txt’te Disallow**; Vertex organik SERP crawler’ı değil. Organik indeks için asıl metrik **Googlebot**. |

---

## 1) 20 milyon sayfa — Google & Bing kriterlerine göre

### Teknik indexability (kod + edge)

Tüm `/k/{slug}` URL’leri:

- Deterministik **200** HTML (veya kanonik 301 / temiz 404)
- `index,follow` + canonical
- Unique title (≤69, Bing &lt;70) ve meta description (150–160)
- Kalite skoru eşiği ≥90 (`siteConfig.programmaticQuality.minIndexScore`)
- Guideline-compliant zengin içerik (`functions/_lib/programmaticPage.ts`)

Yani Google/Bing’in **“sayfa dizine eklenebilir mi?”** checklist’i teknik tarafta yeşil.

### Gerçek dünya sınırı (dürüst)

Search engine’ler 20M kombinatoryal URL’yi bir anda indekslemez:

| Ramp | Sitemap’te duyurulan | Gate (GSC) — `rampController.ts` |
|------|----------------------|-----------------------------------|
| **0 (aktif)** | **500.000** | indexed ≥%95, CNI ≤%5, impressions ≥10K → Level 1 |
| 1 | 2.000.000 | … |
| 2 | 5.000.000 | … |
| 3 | 9.000.000 | … |
| 4 | 14.000.000 | … |
| 5 | **20.000.000** | tam corpus |

**Kritik:** Edge sitemap (`EMBEDDED_RAMP_LEVEL = 0`) bilerek **500K** ile sınırlı. 20M’yi tekrar sitemap’e koymak crawl budget’ı seyreltir ve “Discovered – currently not indexed” şişirir (bkz. `docs/indexing-root-fix-2026-08-12.md`).

**Sonuç:** “Tamamı indexable” ≠ “tamamı indexed”. Strateji: 500K’yı yüksek oranda indeksle → otomatik ramp → kademeli büyüme.

---

## 2) Cloudflare Function — tetikleme & maliyet

### Ne zaman Function çalışır?

`public/_routes.json` Function’ı yalnızca şu path’lere bağlar:

- `/k/*`
- `/sitemap.xml`
- `/sitemaps/*`

Akış:

```
İstek → WAF (engel = 0 Function)
      → CDN Cache HIT = 0 Function
      → Cache MISS → Pages Function (~deterministik HTML) → edge cache’e yaz
```

### Maliyet modeli (Free plan)

| Trafik | Function | Not |
|--------|----------|-----|
| Sahte bot / scraper (WAF block) | **0** | Edge’de kesilir |
| Googlebot tekrar ziyaret (cache HIT) | **0** | `s-maxage=2592000` (30 gün) + stale-while-revalidate |
| İlk kez /k/ URL (MISS) | **1** | Sonra cache |
| Statik `/tools`, `/guides`, `/` | **0** | Static asset |

**Ek maliyet yaratmayanlar:** `feed.xml`, IndexNow ping, WebSub, build-time sitemap — Function değil.

**Uyarı:** Cache rule yoksa veya purge edilirse her crawl MISS olur → invocation artar. Zone’da `http_request_cache_settings` ruleset mevcut (v13, 2026-07-16). Token cache içeriğini okuyamadı; deploy script (`scripts/deploy-cache-rules.mjs`) kuralı tanımlıyor.

**Özet:** Normal Google/Bing crawl’ında sistem “statik gibi” ucuz çalışacak şekilde kurulmuş. Anormal Function faturası = scraper sızıntısı veya cache rule kaybı demektir; şu anki WAF bunu engellemek için tasarlandı.

---

## 3) Backlink — otomatik mi? 4 backlink yeter mi?

### Otomatik kazanım?

**Hayır.** Repo açıkça belirtiyor: kod ajanı üçüncü taraf backlink üretemez (`docs/backlink-submission-kit.md`, `organization.ts`).

Otomatik / yarı-otomatik olanlar:

- Entity SEO (`sameAs`, Organization JSON-LD)
- Footer / badge (Product Hunt, SaaSHub, Launchstag, tools.cafe)
- GitHub README → site (repo public ise)
- RSS / IndexNow (discovery, backlink değil)

### Senin 4 backlink’in

Faydalı. Google crawl hızı ve indeks oranı için **referring domain kalitesi** sayfa sayısından önemli. 4 kaliteli link:

- Crawl’ı **biraz** artırabilir
- 20M’yi tek başına indekslettirmez
- “Bir daha hiçbir şey yapmama” = yavaş büyüme; otorite için ara sıra listing / gerçek içerik paylaşımı gerekir

---

## 4) Google crawl (~50K) beklentisi

**Olumlu sinyaller (senin gözlem + sistem):**

- Under Attack kapalı
- Son 24h taramalar başarılı
- WAF Rule 0: verified Google/Bing + doğru ASN → challenge/block yok
- Legacy `botd` rate-limit kuralı **disabled** (eski Googlebot 403 kökü kapalı)

**Gerçekçi tempo:**

- Crawl rate otorite, indexed oran, hata oranı, sitemap boyutu ile ölçeklenir
- Ramp 0’da hedef önce **500K’nın yüksek indekslenmesi**, sonra 2M…
- ~50K URL/gün tekrar görülmesi **mümkün** ama tarih garantisi yok; başarılı crawl’lar sürdükçe Google budget’ı genelde yükseltir

Haftalık izle: GSC → Ayarlar / Crawl istatistikleri + “Dizine eklendi” / CNI.

---

## 5) Google Vertex bot (8 başarılı / 8 başarısız)

| Faktör | Durum |
|--------|--------|
| `Google-Extended` robots | **`Disallow: /`** — AI/training & grounding bot’u bilinçli kapalı |
| Organik Googlebot | `Allow: /` — SERP indeksi için asıl bot |
| WAF | Search crawler skip; AI/scraper blok; Extended arama crawler kategorisinde olmayabilir |

**Yorum:** %50 Vertex sonucu organik indeks sağlığını bozmaz. Vertex/Gemini grounding için Extended’i açmak **ayrı ürün kararı** (crawl budget + AI train tradeoff). Şu anki politika: search=yes, ai-train=no (`Content-Signal`).

---

## 6) Cloudflare WAF — canlı inceleme

**Ruleset:** `http_request_firewall_custom` · version **217** · güncelleme **2026-08-12T12:14:41Z** · 5 kural

| # | Kural | Action | Amaç |
|---|-------|--------|------|
| 0 | `[DevSolve] SKIP crawlers + real browsers (never challenge)` | **skip** | Verified search + Google/Bing ASN + GSC Inspection + gerçek tarayıcı → Under Attack / Bot Fight / WAF skip |
| 1 | sitewide block AI indexers + extension scrapers | **block** | Meta/Claude/extension UA |
| 2 | corpus+sitemaps block fake Googlebot/Bingbot | **block** | Yanlış ASN spoof → 0 Function |
| 3 | corpus+sitemaps allowlist | **block** | Allow dışı her şey `/k/`+sitemap’te blok |
| 4 | `sasd` (kullanıcı) | **block** | `/wp-admin`, `/wp-load`, `/storage/index.php` |

Skip parametreleri: `securityLevel`, `sbfm`, `waf`, `rateLimit`, `bic`, … — crawler’ların challenge görmemesi için doğru.

**Rate limit:** Legacy `botd` (`/k/` + not verified_bot) → **enabled=false** ✅

**Managed Free Ruleset:** 31 CVE/generic kural aktif (Log4j, WordPress, React RCE vb.) — site güvenliği için normal.

**DDoS L7:** managed ruleset mevcut.

**Probe notu:** Bu bulut ortamının datacenter IP’sinden tüm istekler `cType: managed` challenge alıyor. Bu, senin tarayıcın veya Google ASN crawl’ın başarısını çürütmez; skip kuralı **verified / doğru ASN** trafiğe yazılmış.

---

## 7) Cache kuralları

| Öğe | Durum |
|-----|--------|
| Zone cache ruleset | Var (`http_request_cache_settings`, v13, 2026-07-16) |
| İçerik okuma | API token yetkisiz (detay dump yok) |
| Kod beklentisi | `/k/*`, `/sitemap.xml`, `/sitemaps/*`, `/sitemap-*`, `/feed.xml` → Eligible for cache, `respect_origin` |
| Origin TTL | `/k/*` s-maxage **30 gün**; sitemap daha kısa; content version cache key’de |

Dashboard’da kuralın **enabled** olduğunu bir kez doğrula:  
Caching → Cache Rules → `[DevSolve] edge-cache programmatic corpus + sitemaps…`

---

## 8) Sistem sağlık skoru

| Bileşen | Skor | Not |
|---------|------|-----|
| Zone / DNS | ✅ | active, Free, paused=false |
| WAF custom | ✅ | 4 DevSolve + 1 wp kuralı, bugün güncel |
| Crawler skip | ✅ | Google/Bing korunuyor |
| Legacy botd | ✅ | kapalı |
| Cache architecture | ✅ / ⚠️ | Mimari doğru; dashboard teyidi önerilir |
| Function cost control | ✅ | WAF + cache + dar `_routes` |
| Indexability (20M) | ✅ | teknik hazır |
| İndeks kapsamı (şimdi) | ⚠️ | bilerek 500K ramp |
| Backlink / otorite | ⚠️ | 4 link + directory; büyütülmeli |
| Vertex / Extended | ℹ️ | kasıtlı kapalı; organik için kritik değil |
| Under Attack | ✅ (senin beyanın) | Kapalı kalmalı; tekrar açma |

**Genel:** Sistem **sağlıklı ve güvenli**. İndeksleme darboğazı artık altyapı değil; **crawl budget ramp + otorite + kalite kapıları**.

---

## 9) Senin yapman gerekenler (minimum)

1. **Under Attack kapalı kalsın** (Essentially Off / Medium).
2. GSC’de haftalık: Indexed, CNI, crawl stats — ramp gate’e yaklaşınca Level 1 otomatik (`ramp-auto-advance`).
3. Backlink: kit’teki white-hat listeden 2–3 kaliteli domain daha (Product Hunt zaten var; AlternativeTo onay → `BRAND_ALTERNATIVETO_LIVE=true`).
4. Vertex %50’yi organik kriz sanma; Extended’i açmak istemiyorsan yok say.
5. Cloudflare → Cache Rules + Analytics’te Function invocation’ların düşük kaldığını ayda bir göz at.

**Yapma:** Sitemap’i elle 20M’ye açma; link farm / satın alınmış backlink; Under Attack’i tekrar açma.

---

## 10) Sonuç cümlesi

20M sayfa **indexable ve güvenli edge’de hazır**; Google/Bing **şimdi 500K’yı** sindirmeli. Function maliyeti **cache HIT + WAF** ile kontrol altında. Backlink **otomatik gelmez** — 4 link iyi başlangıç, otorite işi devam eder. Crawl’ın tekrar 50K bandına çıkması **mümkün ve mevcut yeşil sinyallerle uyumlu**, ama süre garantisi yok; Vertex karışık sonuçları organik sağlığı bozmuyor.
