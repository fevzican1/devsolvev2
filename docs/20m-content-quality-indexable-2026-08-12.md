# 20M içerik kalitesi + indexability — uygulama raporu

**Tarih:** 2026-08-12  
**Agent:** `devsolve-ai-indexing-agent` **v2026-08-12.3**  
**Content version:** `20260812c` (`CONTENT_UPDATED_AT=2026-08-12T15:30:00.000Z`)  
**Branch:** `cursor/20m-content-quality-indexable-f7b5`

---

## Talimatın karşılanması

| İstek | Sonuç |
|-------|--------|
| Teknik indexable (200, canonical, meta, robots) | Korundu + güçlendirildi |
| İçerik kalitesi / near-duplicate çözümü | **Gövde havuzları style×context’e bağlandı** + differentiation bloğu |
| AI sistemi (crawl’da kusursuz sayfa) | AI Indexing Agent v3 + Phase E sibling gate |
| Son güncellemeleri bozma | Ramp 500K, WAF, title≤69, meta 150–160, Hashnode/dev.to/IH, anti-cloak **dokunulmadı** |
| Tek sorun istemiyorum | Gate: skor ≥90, 0 critical guideline, sibling Jaccard ≤0.50 |

**Dürüst sınır (motor gerçeği):** Her URL **indexable** (Google/Bing kural kitabına göre seçilmeye uygun). Sitemap hâlâ ramp 0 = **500K duyuru** — 20M’yi birden sitemap’e koymak crawl waste üretir ve indeksi yavaşlatır. “Indexable” ≠ “aynı gün 20M indexed”; sistem tüm 20M’yi kalite+teknik olarak hazır tutar, keşif ramp ile büyür.

---

## Ne değişti (kod)

### 1. `functions/_lib/programmaticPage.ts` — gövde benzersizliği

Önceki boşluk: steps / pitfalls / FAQ / glossary / comparison / tips havuzları **style×context taşımıyordu** → 180 kardeş URL aynı cümleleri paylaşıyordu.

Şimdi **her havuz cümlesi** `sv.phrase` / `cv.phrase` (ve audience/task) bağlıyor:

- keyTakeaways, baseSteps, clusterSteps  
- genericPitfalls, clusterPitfalls  
- comparison, proTips, technical, useCases  
- glossary (dimension-specific terimler)  
- faqPool  

Yeni bölüm: **`differentiation`** (“Why this exact URL”) — 6 paragraf, kardeş URL’lerden bilinçli ayrışma + coordinate lock (`intent/tool/audience/task/style/context/slug`).

`CONTENT_VERSION` → **`20260812c`** (ETag + edge cache key invalidation; Purge Everything şart değil).

### 2. AI Indexing Agent v2026-08-12.3

`scripts/lib/ai-indexing-agent.mjs`:

- `requireUniqueSiblingBodies: true`  
- `maxSiblingBodyJaccard: 0.5` (3-gram; gerçek near-dup genelde ≥0.8)  
- Banner / contract güncellendi  

### 3. Rulebook

`scripts/lib/search-guidelines.mjs` → corpus kuralı **`unique-sibling-bodies`** (Bing abuse: auto-gen / duplicate).

### 4. Gate Phase E

`scripts/verify-edge-corpus-quality.mjs`:

- A vocabulary · B identity · C document · D routing · **E sibling body Jaccard**  
- Style **ve** context zorunlu değişen modifier üçlüsü  
- `<main>` prose (H2 chrome çıkarılmış)

---

## Kanıt (bu PR’da koşturulan gate)

Hızlı doğrulama (örnek):

```
[A] vocabulary — worst-case title 69, problems 0
[B] identity — unique title/desc/H1, length OK
[C] documents — min score 97, avg ~98.9, min words ≥2080, guideline violations: none
[D] routing — canonical / 301 / 404 OK
[E] sibling bodies — max Jaccard 0.483 ≤ 0.50 → PASS
```

Full build’de Phase B varsayılanı **20M identity sweep** (önceki davranış aynı).

---

## Bing § / Google Page Indexing haritası (sistem)

| Alan | Durum |
|------|--------|
| §2–5 Discovery, sitemap, links, IndexNow | Aktif (ramp + iç link + IndexNow) |
| §6–9 Canonical, 301, render, 404 | Aktif |
| §10–14 Meta, data-snippet, schema, HTML | Aktif |
| §15–18 Verifiable, entity, single-topic, early answer | Aktif (+ differentiation) |
| §21 Crawl waste | Ramp 500K (bilinçli) |
| Abuse: cloaking | Yasak (aynı HTML tüm UA) |
| Abuse: near-duplicate / auto-gen | **Havuz bağlama + Phase E** |
| GSC: 5xx / soft 404 / noindex / yanlış canonical | Tasarımda kapalı |
| GSC: CNI / Discovered | Ramp + otorite ile yönetilir (kalite kapısı değil) |

---

## Deploy sonrası (operatör)

1. Deploy bitsin.  
2. İsteğe bağlı: Cloudflare **Purge Everything** (version key zaten invalidate eder).  
3. GSC + Bing’de **mevcut** `https://devsolvev2.com/sitemap.xml` yenile — 20M’lik eski indeks ekleme.  
4. Under Attack kapalı kalsın.

---

## Dosya listesi

- `functions/_lib/programmaticPage.ts`  
- `scripts/lib/ai-indexing-agent.mjs`  
- `scripts/lib/search-guidelines.mjs`  
- `scripts/verify-edge-corpus-quality.mjs`  
- `docs/20m-content-quality-indexable-2026-08-12.md` (bu rapor)
