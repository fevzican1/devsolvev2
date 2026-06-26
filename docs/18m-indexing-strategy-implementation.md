# 18M İndeksleme Master Strateji — Teknik Uygulama Dokümantasyonu

**Tarih:** 26 Haziran 2026  
**Durum:** Faz 0 uygulaması tamamlandı, aktif  
**Hedef:** 18.040.320 /k/* sayfasını kırpmadan, 12M–16M indeks (18–36 ay)

---

## Uygulanan Değişiklikler Özeti

### EKSİK #1: Dinamik Discovery Link Rotasyonu ✅

**Dosya:** `functions/k/[[slug]].ts` — `buildInternalLinkMatrix()`

**Değişiklik:**
- Discovery linkler artık `hash(slug + weekNumber)` seed ile haftalık döner
- 6 → 8 discovery link (daha geniş corpus coverage)
- Primary linkler (10) slug-sabit kalır (semantic neighborhood korunur)
- Her /k/ sayfasından ilgili guide'a backlink eklendi (CLUSTER_TO_GUIDE mapping)

**Cache Etkisi:**
- `stale-while-revalidate`: 7 gün (daha önce 24 saat)
- `s-maxage`: 1 saat (değişmedi)
- Haftalık rotasyon edge cache revalidation ile doğal olarak yayılır

**Başarı Kriteri:** Aynı URL'ye 7 gün arayla gelen crawl'da discovery href'lerin ≥50%'si farklı.

---

### EKSİK #2: Cluster Mapping Tablosu ✅

**Dosya:** `src/config/clusterMapping.ts`

**İçerik:**
- 17 guide × programmatic cluster tam mapping tablosu
- Her guide için: programmaticClusters, mappedIntents, programmaticTools, linkCount, placement
- Yardımcı fonksiyonlar: `getMappingForGuide()`, `getGuidesForCluster()`, `getGuidesForIntent()`
- `buildGuideOutboundSlugs()`: Guide sayfalarına inject edilecek /k/ link listesi üretir
- `getGuideBacklinkForPage()`: /k/ sayfasından en uygun guide'a backlink döner

**Kullanım:**
```typescript
import { buildGuideOutboundSlugs } from '@/config/clusterMapping';

// Guide footer'da kullan
const links = buildGuideOutboundSlugs('jwt-decoding-browser');
// → [{ slug: '...', href: '/k/...', label: '...' }, ...]
```

---

### EKSİK #3: Sitemap Rampa Musluğu ✅

**Dosya:** `src/config/rampController.ts`

**Değişiklikler:**
- Varsayılan sitemap limiti: **500K** (daha önce 18M tam açık)
- Tek kontrol noktası: `PROGRAMMATIC_RAMP_LEVEL` env var (0–5)
- Her level: sitemapLimit + indexNowSliceSize + gate metrikleri birlikte
- `monetizationConfig.opsFlags.programmaticRampLevel`: 5 → **0**

**Ramp Levels:**

| Level | Sitemap | IndexNow/Run | Gate: Indexed Ratio | Gate: CNI Max |
|-------|---------|-------------|--------------------|----|
| 0 | 500K | 2,000 | ≥30% | ≤55% |
| 1 | 2M | 4,000 | ≥40% | ≤50% |
| 2 | 5M | 6,000 | ≥50% | ≤45% |
| 3 | 9M | 8,000 | ≥55% | ≤45% |
| 4 | 14M | 10,000 | ≥57% | ≤40% |
| 5 | 18M | 10,000 | ≥67% | ≤35% |

**Musluk açma:**
```bash
# Gate metrikleri karşılandığında (GSC'de doğrula):
PROGRAMMATIC_RAMP_LEVEL=1 npm run build
```

---

### Bot Guard Güncellemesi ✅

**Dosya:** `functions/_shared/botGuard.ts`

**Değişiklik:**
- Social preview botları (Twitter, LinkedIn, Slack, Discord, Telegram, WhatsApp, Reddit, Pinterest, Mastodon) artık **izin veriliyor**
- Bu botlar link equity ve referral trafik için gerekli
- Sadece human-shared URL'lerde tetiklenir (otomatik crawl değil)
- Edge-cached yanıt → sıfır ekstra Cloudflare maliyeti

**Kaldırılan hard-block'lar:**
- `facebookexternalhit`, `facebookbot` → şimdi social preview olarak izinli
- `twitterbot`, `linkedinbot`, `slackbot`, `discordbot` vb. → izinli

---

### Quality Scoring — SPE Layer Diversity ✅

**Dosya:** `src/lib/quality/scoring.ts`

**Değişiklikler:**
- Yeni metrik: `layerDiversity` (0–15 puan)
- 7 SPE katmanının ne kadarının populate edildiğini ölçer
- `simulatedReviews` word count hesabından çıkarıldı (E-E-A-T risk)
- Breakdown'a `layerDiversity` eklendi

---

### Hub Discovery — Zaman Bazlı Rotasyon ✅

**Dosya:** `src/lib/indexing/hubDiscovery.ts`

**Değişiklikler:**
- Hub link sayısı: 30 → **50**
- %60 priority (stabil) + %40 weekly-discovery (döner)
- `/k` hub path eklendi DEFAULT_HUB_PATHS'e
- `rotationWeek` field eklendi snapshot'a
- Seed artık weekNumber bazlı (daha önce dayNumber)

---

### SimulatedReviews Kaldırma ✅

**Dosyalar:**
- `src/app/k/[slug]/page.tsx` — Community Feedback section kaldırıldı
- `src/app/tools/[slug]/page.tsx` — Community Feedback section kaldırıldı
- `src/lib/quality/scoring.ts` — simulatedReviews word count'tan çıkarıldı

**Neden:** Sahte review = E-E-A-T ceza riski. Google scaled-content classifier'ı bunu yakalar.

---

## Faz Geçiş Prosedürü

### Faz 0 → Faz 1 geçiş (hedef: Ay 2-4)

**Gate metrikleri (GSC'de kontrol):**
- Indexed URL sayısı ≥ 150K (sitemap'teki 500K'nın %30'u)
- Crawled-not-indexed oranı ≤ %55
- Aylık impression ≥ 10K
- Bot 403 hatası = 0

**Geçiş adımları:**
1. GSC metrikleri doğrula
2. `PROGRAMMATIC_RAMP_LEVEL=1` ayarla (GitHub Actions secret veya wrangler.toml)
3. Deploy et → sitemap otomatik olarak 2M'ye genişler
4. IndexNow slice 4K'ya çıkar

### Sonraki fazlar için aynı prosedür

Her faz geçişinde:
1. Önceki fazın gate metriklerini doğrula
2. `PROGRAMMATIC_RAMP_LEVEL` değerini artır
3. Deploy et

---

## Kalan Uygulama Adımları (Henüz Yapılmamış)

### Faz 1 — Guide → /k/ Link Modülü
- [ ] Her guide markdown'una `buildGuideOutboundSlugs()` çıktısını inject et
- [ ] Guide detay page'lerinde "Explore Related Scenarios" section ekle
- [ ] `programmaticLinkCountTarget` verilerini guide renderer'da kullan

### Faz 2 — SPE Full Content Rewrite
- [ ] 162 modifier varyantının tüm sayfayı etkilemesi (sadece 1 bölüm değil)
- [ ] Troubleshooting decision tree (Katman 5)
- [ ] Interactive tool pre-fill (Katman 7)

### Faz 3 — Otorite İnşası
- [ ] 17 → 120 flagship guide (intent başına 1)
- [ ] Backlink kampanyası (hub + flagship)

---

## Ortam Değişkenleri Referansı

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `PROGRAMMATIC_RAMP_LEVEL` | `0` | Aktif ramp seviyesi (0-5) |
| `PROGRAMMATIC_SITEMAP_LIMIT` | (ramp'tan) | Legacy override: direkt sitemap limiti |
| `INDEXNOW_MAX_PER_RUN` | `2000` | IndexNow rolling slice boyutu |
| `INDEXNOW_BATCH_SIZE` | `100` | IndexNow batch boyutu |
| `INDEXNOW_DELAY_MS` | `2000` | Batch arası bekleme |
| `INDEXNOW_DISABLED` | - | `1` = IndexNow'u atla |
| `INDEXNOW_DRY_RUN` | - | `1` = Göster ama gönderme |

---

## Monitoring Checklist (Haftalık)

- [ ] GSC: Indexed sayısı artıyor mu?
- [ ] GSC: Crawled-not-indexed oranı azalıyor mu?
- [ ] GSC: "Discovered – currently not indexed" trendi
- [ ] Bing WMT: "Bulk submission mode" uyarısı var mı?
- [ ] Bing WMT: Indexed URL sayısı
- [ ] Bot 403 logları: Googlebot/Bingbot 200 alıyor mu?
- [ ] Impression/click trendi: Haftalık artış var mı?
- [ ] Discovery link rotasyonu: Crawl log'da farklı linkler görülüyor mu?
