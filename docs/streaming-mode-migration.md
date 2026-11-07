# Event-Driven Streaming Mode — Batch'tan Geçiş Rehberi

## Özet

Bu belge, `devsolvev2` sitesinin **Batch Mode'dan Event-Driven Streaming Mode'a** geçişini dokumentar eder. Geçiş sonrası sayfalar Google ve Bing tarafından daha hızlı keşfedilir ve indexlenir; crawl bütçesi boşa harcanmaz.

> **Not:** Bu mimari arama motorunun toplam bütçesini "sihirli bir şekilde artırmaz"; mevcut bütçenin **boşa harcanmasını engeller** ve bütçeyi taze/değişen içeriklere yönlendirir.

## 1. Batch Mode vs Event-Driven Streaming Mode

| Özellik | Batch Mode (Eski) | Event-Driven Streaming Mode (Yeni) |
|---------|-------------------|------------------------------------|
| Tetikleme | Zamanlanmış /Build'te tüm corpus | Sadece yeni/değişen URL'ler (delta) |
| IndexNow payload | Tüm corpus / binlerce URL | Küçük parça (slice), 100-12K URL/çalışma |
| Gönderim sıklığı | Her deploy'da tek seferlik büyük döküm | Build'te anında + gündelik yuvarlak dilim |
| Sunucu yükü | Ani spike → 503 riski → crawl rate düşer | Stabil, paced → crawl rate artar |
| Keşif hızı | Günler/haftalar (sitemap döngüsü) | Dakikalar (IndexNow anlık sinyal) |
| Crawl bütçesi | Değişmemiş sayfalarla boşa harcanır | Sadece değişen sayfalara odaklanılır |

## 2. Mimari Bileşenler

### 2.1. `scripts/lib/streaming-mode-config.mjs` (YENİ)

Tek kaynak konfigürasyon dosyası. Ramp seviyesine bağlı olarak:
- Sitemap limiti (500K → 20M)
- IndexNow dilim boyutu (2K → 12K URL/çalışma)
- IndexNow batch boyutu (100 URL/HTTP çağrı)
- IndexNow pacing gecikmesi (2000 → 1000 ms)

### 2.2. `scripts/ai-quality-gatekeeper.mjs` — Değişiklik Tespiti

HTML'leri tarar, içerik hash'ini hesaplar ve önceki build ile karşılaştırır. Yeni/değişen URL'leri `out/reports/ai-quality-new-urls.txt`'ye yazar. Bu **event-driven delta** kaynağıdır.

### 2.3. `scripts/ai-quality-indexnow-submit.mjs` — Adım 1/2 (Anında Delta)

Yeni/değişen, AI kalite kapısını geçen URL'leri **anında** IndexNow'a gönderir. Build anında çalışır, bekleme süresi yoktur.

### 2.4. `scripts/indexnow-ping.mjs` — Adım 2/2 (Yuvarlak Dilim)

Günlük cron ile çalışır. Sitemap dosyalarını akıllı okur, deterministic bir günlük dilim seçer ve küçük, sıralı parçalar halinde IndexNow'a gönderir. Tüm corpus tek seferde **değil**.

### 2.5. `scripts/postbuild.mjs` — Orkeştasyon

1. **Adım 1 — Event-Driven Delta:** `ai-quality-indexnow-submit.mjs` (sadece değişenler, anında)
2. **Adım 2 — Rolling Slice:** `indexnow-ping.mjs` (paced, yuvarlak dilim)

Her iki adım da **best-effort** — ağ hatası deploy'ı engellemez.

### 2.6. `src/config/rampController.ts` — Ramp Kontrolü

| Level | Sitemap | IndexNow Dilim | Açıklama |
|-------|---------|----------------|----------|
| 0 | 500K | 2K | Faz 0 — Foundation |
| 1 | 2M | 4K | Faz 1 — SPE Full |
| 2 | 5M | 6K | Faz 2 |
| 3 | 9M | 8K | Faz 3 |
| 4 | 14M | 10K | Faz 4 |
| 5 | 20M | 12K | Faz 5 — Tam corpus |

Mevcut `.ramp-level = 5` (tam 20M corpus ilan ediliyor).

## 3. Çalışma Akışı (Postbuild)

```
next build
    │
    ▼
ai-quality-gatekeeper.mjs      → Yeni/değişen URL'leri tespit et (content-hash diff)
    │
    ▼
ai-quality-indexnow-submit.mjs → [STREAMING ADIM 1] Anında IndexNow delta gönderimi
    │
    ▼
generate-ai-quality-sitemaps.mjs → Kaliteli sayfaları sitemap'e ekle
    │
    ▼
indexnow-ping.mjs              → [STREAMING ADIM 2] Paced rolling slice IndexNow
    │
    ▼
free-discovery-ping.mjs        → WebSub + Google sitemap ping (keşif)
    │
    ▼
Deploy → Cloudflare Pages
```

## 4. Google ve Bing İçin Etkileri

### 4.1. Keşif Hızı (Time-to-Index)

- **Batch mod:** Yeni sayfa, botların sıradaki sitemap tarama döngüsüne denk gelmek zorundadır (günler/haftalar).
- **Streaming mod:** Sayfa oluştuğu an IndexNow sinyali gider; yeni içerikler **dakikalar içinde** taranır.

### 4.2. Crawl Bütçesi İsrafı Önleme

- **Batch mod:** Botlar milyonlarca değişmemiş sayfayı tekrar indirir, bütçe tüketir.
- **Streaming mod:** Delta sitemap ve HTTP 304 yapısı, botların sadece değişen sayfalara odaklanmasını sağlar.

### 4.3. Sunucu Sağlığı ve Crawl Rate

- **Batch mod:** Ani yüklenme (spike) → 503 → crawl rate otomatik düşürülür.
- **Streaming mod:** Rate limiting ile sunucu stabil kalır; bot güveni artar, crawl frekansı yükselir.

## 5. Yapılandırma

### 5.1. Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| `PROGRAMMATIC_RAMP_LEVEL` | Ramp seviyesi (0-5) | `.ramp-level` dosyasından |
| `INDEXNOW_KEY` | IndexNow / Bing anahtarı | `ee5098cac2284d92b6ee1c9fca52a120` |
| `SITE_URL` | Kanonik origin | `https://devsolvev2.com` |
| `INDEXNOW_DELAY_MS` | IndexNow gecikmesi (ms) | Ramp level bazlı |
| `INDEXNOW_DRY_RUN=1` | Tarama yap ama gönderme | `false` |
| `INDEXNOW_DISABLED=1` | IndexNow'u tamamen atla | `false` |

### 5.2. `.ramp-level` Dosyası

CI tarafından otomatik güncellenen, build zamanında okunan tek dosya. Mevcut değer: **5**.