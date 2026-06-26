# Ramp Auto-Advance — Kullanım Kılavuzu

## Ne Yapar?

`ramp-auto-advance` workflow'u her Pazartesi 06:00 UTC'de çalışır ve Google Search Console (GSC) verilerini kontrol eder. Mevcut ramp level'ın gate kriterleri karşılanmışsa:

1. `.ramp-level` dosyasını günceller ve commit atar (doğrudan default branch'e — PR açılmaz).
2. Cloudflare Pages Deploy Hook'u tetikler → site yeni sitemap limiti ile yeniden build edilir.

Gate geçilmediyse yalnızca log yazar, hiçbir şey değişmez.

---

## Mimari

```
Her Pazartesi 06:00 UTC
        ↓
scripts/check-gsc-gate.mjs
        ↓ GSC API (impressions + sitemaps.list)
Gate kriterleri kontrol edilir
        ↓
  Geçti?
  ├── EVET → .ramp-level güncelle → git push → Cloudflare deploy hook
  └── HAYIR → log yaz, dur
```

### Ramp Level Tablosu

| Level | Sitemap Limiti | Sonraki faza geçiş için (GSC gate) |
|-------|---------------|-----------------------------------|
| 0 → 1 | 500K → 2M | indexed ≥%30, CNI ≤%55, impressions ≥10K |
| 1 → 2 | 2M → 5M | indexed ≥%40, CNI ≤%50, impressions ≥100K |
| 2 → 3 | 5M → 9M | indexed ≥%50, CNI ≤%45, impressions ≥1M |
| 3 → 4 | 9M → 14M | indexed ≥%55, CNI ≤%45, impressions ≥5M |
| 4 → 5 | 14M → 18M | indexed ≥%57, CNI ≤%40, impressions ≥20M |
| 5 (max) | 18M tam | — |

---

## Gerekli GitHub Secrets

### `GOOGLE_SERVICE_ACCOUNT_JSON` ✅ (zaten mevcut)

Google Search Console'a okuma erişimi olan bir service account'ın JSON anahtarı.  
Kurulum için: [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)

### `CLOUDFLARE_DEPLOY_HOOK_URL` ⚠️ (kullanıcı eklemeli)

Cloudflare Pages deploy hook URL'si. Eklemek için:

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → `devsolvev2`
2. Settings → Builds & deployments → **Deploy hooks**
3. "Add deploy hook" → İsim: `ramp-auto-advance` → Branch: `agent-pages-manage-crawl-budget-dd8b`
4. Oluşturulan URL'yi kopyala
5. GitHub → Settings → Secrets and variables → Actions → **New repository secret**
   - Name: `CLOUDFLARE_DEPLOY_HOOK_URL`
   - Secret: kopyalanan URL

---

## Manuel Override

### Seçenek 1: `.ramp-level` dosyasını elle düzenle

```bash
echo "2" > .ramp-level
git add .ramp-level
git commit -m "chore(ramp): manual advance to level 2"
git push
```

Ardından Cloudflare'den yeniden deploy et.

### Seçenek 2: `PROGRAMMATIC_RAMP_LEVEL` env var (en yüksek öncelik)

Cloudflare Pages → Settings → Environment variables:

```
PROGRAMMATIC_RAMP_LEVEL = 2
```

Bu değer `.ramp-level` dosyasından daha yüksek önceliğe sahiptir.

### Seçenek 3: Workflow'u elle tetikle

GitHub → Actions → **Ramp Auto-Advance** → **Run workflow**

---

## Ramp Level Öncelik Sırası (Build-Time)

1. `PROGRAMMATIC_RAMP_LEVEL` env var → en yüksek öncelik (manual override)
2. `.ramp-level` dosyası → CI tarafından otomatik güncellenir (build-time'da `fs.readFileSync` ile okunur)
3. `defaultRampLevel = 0` → fallback

> **Önemli:** `.ramp-level` dosyası yalnızca build-time'da okunur (`fs.readFileSync`). Cloudflare Worker / edge runtime'da `fs` modülü kullanılamaz — orada `PROGRAMMATIC_RAMP_LEVEL` env var kullanılmalıdır.

---

## 36 Ay Takvimi vs Otomatik Geçiş

Dokümandaki **36 ay** süresi, Google'ın tipik indeksleme hızına göre yapılmış **muhafazakâr bir üst sınır tahminidir** — workflow'un çalışma periyodu değildir.

Otomatik ramp şöyle çalışır:

- Workflow **her Pazartesi** GSC verisine bakar (istersen Actions'tan anında manuel tetikleyebilirsin).
- Gate kriterleri **gerçek GSC metriklerine** dayanır: indexed oranı, CNI, impression.
- Kriterler erken karşılanırsa bir sonraki faza **haftalar içinde** geçilebilir; 36 ay beklemek gerekmez.
- Kriterler karşılanmazsa level **asla artmaz** — güvenli taraf.

Pratik örnek: Faz 0→1 için ~150K indexed + %30 oran + 10K impression gerekir. Bunu 2–3 ayda görürsen, workflow bir sonraki Pazartesi (veya manuel tetiklemede hemen) level 1'e geçer ve sitemap 2M'e çıkar.

## Kurulum (Senin Yapman Gerekenler)

Otomasyon kod tarafında hazır. Canlıya almak için **tek seferlik** şunlar gerekli:

1. **PR #106'yı merge et** — ramp auto-advance kodu default branch'e girsin.
2. **`CLOUDFLARE_DEPLOY_HOOK_URL` secret'ını ekle** (GitHub → Settings → Secrets → Actions).
   - Cloudflare Pages → devsolvev2 → Settings → Deploy hooks → yeni hook
   - Branch: `agent-pages-manage-crawl-budget-dd8b`
3. **`GOOGLE_SERVICE_ACCOUNT_JSON` secret'ının GSC erişimi olduğunu doğrula**
   - Service account, Search Console'da `devsolvev2.com` property'sine en az **Full** veya **Restricted** okuma erişimine sahip olmalı.
4. **Cloudflare'de `PROGRAMMATIC_RAMP_LEVEL` env var'ını SET ETME**
   - Bu var set edilirse `.ramp-level` dosyasını override eder ve otomasyon devre dışı kalır.
5. **İlk gate kontrolünü manuel tetikle** (isteğe bağlı): GitHub → Actions → Ramp Auto-Advance → Run workflow

Bundan sonra sistem tamamen otomatik çalışır — gate geçince `.ramp-level` güncellenir, deploy hook tetiklenir, sitemap limiti artar.

---

## Güvenlik Notları

- Ramp level hiçbir zaman geri düşmez (level 2'deyken 1'e geçmez).
- GSC API'den indexed URL sayısı alınamazsa script sessizce başarısız olur — gate geçmez, hata fırlatmaz.
- Workflow commit'i `github-actions[bot]` author ile yapılır, PR açılmaz.
- Mevcut `.github/workflows/indexing-priority.yml` değiştirilmemiştir.

---

## İlgili Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `.ramp-level` | Mevcut ramp level (repo root, içinde sadece bir rakam) |
| `src/config/rampController.ts` | Gate kriterleri ve level tanımları |
| `scripts/check-gsc-gate.mjs` | GSC API'yi çağırır, gate kontrolü yapar |
| `.github/workflows/ramp-auto-advance.yml` | Haftalık otomatik workflow |
