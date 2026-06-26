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

| Level | Sitemap Limiti | Gate: Min Indexed Ratio | Gate: Max CNI | Gate: Min Impressions |
|-------|---------------|------------------------|--------------|----------------------|
| 0 | 500.000 | — (başlangıç) | — | — |
| 1 | 2.000.000 | %30 | %55 | 10.000 |
| 2 | 5.000.000 | %40 | %50 | 100.000 |
| 3 | 9.000.000 | %50 | %45 | 1.000.000 |
| 4 | 14.000.000 | %55 | %45 | 5.000.000 |
| 5 | 18.040.320 | %57 | %40 | 20.000.000 |

---

## Gerekli GitHub Secrets

### `GOOGLE_SERVICE_ACCOUNT_JSON` ✅ (zaten mevcut)

Google Search Console'a okuma erişimi olan bir service account'ın JSON anahtarı.  
Kurulum için: [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)

### `CLOUDFLARE_DEPLOY_HOOK_URL` ⚠️ (kullanıcı eklemeli)

Cloudflare Pages deploy hook URL'si. Eklemek için:

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → `devsolvev2`
2. Settings → Builds & deployments → **Deploy hooks**
3. "Add deploy hook" → İsim: `ramp-auto-advance` → Branch: `main`
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
