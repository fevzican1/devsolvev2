# Full-corpus sitemap lock

`.ramp-level` is **5**. `/sitemap.xml` advertises all 20 million `/k/` URLs.
This workflow no longer advances or contracts a staged 2M/5M band. It only
verifies that the edge sitemap and `.ramp-level` still say 5.

Neighbour uniqueness (ctx+1 / style+1 5-gram Jaccard ≤ 0.04) plus the edge
quality gate are what keep Google/Bing from treating the factory as scaled
junk — not a smaller advertised set.

---

# Ramp Auto-Advance — archive (disabled)

The previous Monday GSC auto-advance/contract path is retired. The rest of
this file is historical.

## Ne Yapar?

`ramp-auto-advance` workflow'u her Pazartesi 06:00 UTC'de çalışır ve Google Search Console (GSC) verilerini kontrol eder.

**Yükseltme:** Mevcut ramp level'ın gate kriterleri karşılanmışsa:

1. `.ramp-level` dosyasını günceller ve commit atar (doğrudan default branch'e — PR açılmaz).
2. `functions/_lib/embeddedRamp.ts` içindeki `EMBEDDED_RAMP_LEVEL` aynı değere çekilir (edge sitemap lockstep).
3. Cloudflare Pages Deploy Hook'u tetikler → site yeni sitemap limiti ile yeniden build edilir.

**Daralma:** Advertised sitemap'in indexed oranı %20'nin altındaysa ve mevcut level 1'in üstündeyse, level bir basamak düşer (aynı commit + deploy yolu). Level 1'in (2M) altına otomatik inilmez.

Gate geçilmediyse ve daralma eşiği de yoksa yalnızca log yazar, hiçbir şey değişmez.

---

## Mimari

```
Her Pazartesi 06:00 UTC
        ↓
scripts/check-gsc-gate.mjs
        ↓ GSC API (impressions + sitemaps.list)
Gate kriterleri kontrol edilir
        ↓
  Indexed oranı < %20 ve level > 1?
  ├── EVET → .ramp-level bir basamak düşür → git push → Cloudflare deploy hook
  └── HAYIR
        ↓
  Tüm yükselme kriterleri geçti mi?
  ├── EVET → .ramp-level +1 → git push → Cloudflare deploy hook
  └── HAYIR → log yaz, dur
```

### Ramp Level Tablosu

Kaynak: `src/config/rampController.ts` / `scripts/check-gsc-gate.mjs` — bu tablo kodla birebir aynıdır.

| Level | Sitemap Limiti | Sonraki faza geçiş için (GSC gate) |
|-------|---------------|-----------------------------------|
| 0 → 1 | 500K → 2M | indexed ≥%95, CNI ≤%5, impressions ≥10K |
| 1 → 2 | 2M → 5M | indexed ≥%95, CNI ≤%5, impressions ≥100K |
| 2 → 3 | 5M → 9M | indexed ≥%96, CNI ≤%4, impressions ≥1M |
| 3 → 4 | 9M → 14M | indexed ≥%97, CNI ≤%3, impressions ≥5M |
| 4 → 5 | 14M → 20M | indexed ≥%97, CNI ≤%3, impressions ≥20M |
| 5 (max) | 20M tam | — |

**Aktif (2026-08-20):** Level **1** — sitemap 2.000.000 URL ilan eder. 20.000.000 `/k/` sayfasının tamamı 200 + `index,follow` + canonical ile **indexlenebilir** kalır; ramp yalnızca keşif hızını (sitemap + IndexNow) kısar.

20M URL'i sitemap'e koymak crawl budget'ı seyreltir ve Google/Bing'in "Discovered – currently not indexed" / scaled-content değerlendirmesini şişirir. Bu yüzden tam corpus, GSC kapıları kanıtlanmadan sürülmez.

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

`.ramp-level` ve `functions/_lib/embeddedRamp.ts` **aynı anda** güncellenmeli (`npm run ramp:verify`).

```bash
echo "2" > .ramp-level
# functions/_lib/embeddedRamp.ts → EMBEDDED_RAMP_LEVEL = 2
npm run ramp:verify
git add .ramp-level functions/_lib/embeddedRamp.ts
git commit -m "chore(ramp): manual advance to level 2"
git push
```

Ardından Cloudflare'den yeniden deploy et.

### Seçenek 2: `PROGRAMMATIC_RAMP_LEVEL` env var (en yüksek öncelik)

Cloudflare Pages → Settings → Environment variables:

```
PROGRAMMATIC_RAMP_LEVEL = 2
```

Bu değer `.ramp-level` dosyasından daha yüksek önceliğe sahiptir. Edge sitemap **bu env'i okumaz** — canlı `/sitemap.xml` her zaman `EMBEDDED_RAMP_LEVEL` ile sınırlıdır.

### Seçenek 3: Workflow'u elle tetikle

GitHub → Actions → **Ramp Auto-Advance** → **Run workflow**

---

## Ramp Level Öncelik Sırası (Build-Time)

1. `PROGRAMMATIC_RAMP_LEVEL` env var → en yüksek öncelik (manual override)
2. `.ramp-level` dosyası → CI tarafından otomatik güncellenir (build-time'da `fs.readFileSync` ile okunur)
3. Fallback = **1** (2M advertised)

> **Önemli:** `.ramp-level` dosyası yalnızca build-time'da okunur (`fs.readFileSync`). Cloudflare Worker / edge runtime'da `fs` modülü kullanılamaz — orada `EMBEDDED_RAMP_LEVEL` kullanılır.

---

## 36 Ay Takvimi vs Otomatik Geçiş

Dokümandaki **36 ay** süresi, Google'ın tipik indeksleme hızına göre yapılmış **muhafazakâr bir üst sınır tahminidir** — workflow'un çalışma periyodu değildir.

Otomatik ramp şöyle çalışır:

- Workflow **her Pazartesi** GSC verisine bakar (istersen Actions'tan anında manuel tetikleyebilirsin).
- Gate kriterleri **gerçek GSC metriklerine** dayanır: indexed oranı, CNI, impression.
- Kriterler erken karşılanırsa bir sonraki faza **haftalar içinde** geçilebilir; 36 ay beklemek gerekmez.
- Kriterler karşılanmazsa level **artmaz**.
- Advertised set'in indexed oranı %20'nin altındaysa level 1'e doğru **bir basamak daralır**.

Pratik örnek: Faz 1→2 için 2M'nin %95'i indexed + CNI ≤%5 + 100K impression gerekir. Bunu gördüğün pazartesi workflow level 2'ye geçer ve sitemap 5M'e çıkar.

## Kurulum (Senin Yapman Gerekenler)

Otomasyon kod tarafında hazır. Canlıya almak için **tek seferlik** şunlar gerekli:

1. Bu PR'ı merge et — ramp auto-advance kodu default branch'e girsin.
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

- Yükseltme asla 5'in üzerine çıkmaz.
- Daralma asla 1'in (2M) altına inmez; GSC verisi yoksa daralmaz.
- GSC API'den indexed URL sayısı alınamazsa script sessizce başarısız olur — gate geçmez, hata fırlatmaz.
- Workflow commit'i `github-actions[bot]` author ile yapılır, PR açılmaz.
- Mevcut `.github/workflows/indexing-priority.yml` değiştirilmemiştir.

---

## İlgili Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `.ramp-level` | Mevcut ramp level (repo root, içinde sadece bir rakam) |
| `functions/_lib/embeddedRamp.ts` | Edge sitemap'in okuduğu kopya — `.ramp-level` ile lockstep |
| `src/config/rampController.ts` | Gate kriterleri ve level tanımları |
| `scripts/check-gsc-gate.mjs` | GSC API'yi çağırır, gate kontrolü yapar |
| `scripts/verify-ramp-sitemap-sync.mjs` | Lockstep doğrulaması (`npm run ramp:verify`) |
| `.github/workflows/ramp-auto-advance.yml` | Haftalık otomatik workflow |
