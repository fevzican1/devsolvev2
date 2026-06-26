# DevSolve Master Rapor — Ek Bölümler (Ek A–M)

**Tarih:** 26 Haziran 2026  
**Durum:** Referans dokümantasyonu  
**İlişkili:** `docs/18m-indexing-strategy-implementation.md`

---

## Ek A — 10 Programmatic Cluster × Tool × Intent Envanteri

SPE ve cluster mapping için tam referans:

| Cluster | Tools | Intent sayısı | Örnek intents |
|---------|-------|---------------|---------------|
| **json** | json-formatter, json-to-typescript | 12 | validate-json, format-json, minify-json-payload, detect-json-syntax-errors |
| **encoding** | base64, url, html-entity | 12 | encode-data, decode-data, fix-encoding-bugs, verify-encoding-roundtrip |
| **security** | hash-generator, uuid-generator, jwt-decoder | 12 | validate-jwt-claims, hash-sensitive-data, audit-token-expiry, analyze-token-payload |
| **text** | text-case-converter, diff-checker, regex-tester | 12 | test-regex, match-complex-patterns, normalize-text, compare-versions |
| **formatting** | markdown-preview, html-formatter | 12 | render-markdown, sanitize-html, format-html, preview-content |
| **api** | curl-builder, api-tester | 12 | test-endpoint, debug-response, validate-schema, document-api-endpoint |
| **data** | csv-converter, xml-formatter | 12 | convert-csv-json, parse-xml, transform-data, migrate-legacy-system |
| **debugging** | log-parser, error-decoder | 12 | parse-log-output, decode-error-stack, trace-request, debug-production-issue |
| **automation** | cron-generator, yaml-formatter | 12 | generate-cron, validate-yaml, automate-workflow, schedule-task |
| **web** | html-encoder, css-formatter | 12 | escape-html, minify-css, validate-markup, optimize-web-output |

**Toplam:** 10 cluster × ~2–3 tool × 12 intent = **348 tool×intent çifti**  
**× 20 audience × 16 task × 162 modifier = 18.040.320**

---

## Ek B — Guide → Programmatic Cluster Mapping (Başlangıç Tablosu)

17 guide için editorial spine başlangıç eşlemesi:

| Guide slug | programmatic cluster | Primary intents (3–5) | linkCount |
|------------|---------------------|----------------------|-----------|
| jwt-decoding-browser | security | validate-jwt-claims, analyze-token-payload, audit-token-expiry, verify-tokens | 15 |
| hashing-integrity | security | hash-sensitive-data, verify-data-integrity, compare-security-hashes | 15 |
| regex-testing-debugging | text | test-regex, match-complex-patterns, find-and-replace-patterns | 18 |
| json-validation-formatting | json | validate-json, format-json, detect-json-syntax-errors, minify-json-payload | 20 |
| base64-usage | encoding | encode-data, decode-data, verify-encoding-roundtrip | 14 |
| url-encoding-pitfalls | encoding | encode-data, escape-special-characters, fix-encoding-bugs | 16 |
| text-transformations | text | normalize-text, convert-character-sets, find-and-replace-patterns | 18 |
| diffing-techniques | text | compare-versions, find-and-replace-patterns | 15 |
| markdown-preview-guide | formatting | render-markdown, sanitize-html, preview-content | 12 |
| html-encoding-guide | encoding / web | escape-html, escape-special-characters | 14 |
| uuid-generation-guide | security | generate-identifiers, rotate-unique-identifiers | 12 |
| cron-scheduling-guide | automation | generate-cron, schedule-task, automate-workflow | 16 |
| yaml-config-guide | automation | validate-yaml, automate-workflow | 14 |
| api-testing-guide | api | test-endpoint, debug-response, document-api-endpoint | 20 |
| xml-data-guide | data | parse-xml, transform-data, migrate-legacy-system | 16 |
| log-debugging-guide | debugging | parse-log-output, decode-error-stack, debug-production-issue | 18 |
| production-token-security | security | validate-jwt-claims, hash-sensitive-data, verify-data-integrity, audit-token-expiry | 24 |

**Kural:** Her guide'ın `programmaticLinkCountTarget` değeri mapping'de `linkCount` olarak kullanılmalı.

---

## Ek C — Ramp Controller Blueprint (Tek Düğme Mimarisi)

### C.1 Ramp level tanımları

| Level | Sitemap limit | IndexNow/run | Priority cap | R2 batch/hafta | Gate indexed min | Gate ratio |
|-------|--------------|--------------|--------------|----------------|------------------|------------|
| 0 | 500.000 | 2.000 | 750K | 5.000 | — | — |
| 1 | 2.000.000 | 2.500 | 750K | 20.000 | 150K | 30% |
| 2 | 5.000.000 | 3.000 | 750K | 50.000 | 800K | 40% |
| 3 | 9.000.000 | 4.000 | 750K | 100.000 | 2.5M | 50% |
| 4 | 14.000.000 | 5.000 | 750K | 200.000 | 5M | 55% |
| 5 | 18.040.320 | 5.000 | 750K | full rotation | 8M | 57% |
| 6 (hedef) | 18.040.320 | 5.000 | 750K | maintenance | 12M | 67% |

### C.2 Level artış prosedürü

```
1. GSC snapshot al (indexed, crawled-NI, discovered-NI)
2. Gate metrikleri kontrol et
3. Geçtiyse:
   a. rampLevel++
   b. PROGRAMMATIC_SITEMAP_LIMIT güncelle
   c. npm run build (sitemap regenerate)
   d. SITEMAP_INDEX_NAME bump (v4, v5…)
   e. GSC + Bing WMT yeni sitemap submit
   f. IndexNow slice kaynağını yeni tier'a genişlet
4. Geçmediyse:
   a. SPE iterasyon (düşük performans cluster)
   b. 30 gün bekle, tekrar ölç
```

### C.3 Senkronize edilecek env/config noktaları

| Config | Dosya | Ramp level'dan türet |
|--------|-------|---------------------|
| `PROGRAMMATIC_SITEMAP_LIMIT` | sitemap script env | rampSchedule[level] |
| `programmaticRampLevel` | monetization.ts | level |
| `SITEMAP_INDEX_NAME` | sitemap script | version bump |
| `INDEXNOW_MAX_PER_RUN` | indexnow-ping.mjs | tablo değeri |
| `TARGET_TOTAL` | programmatic.ts | min(level limit, 18M) |

---

## Ek D — Dinamik Discovery Inject Mimarisi

### D.1 Request flow (hedef)

```
Bot → devsolvev2.com/k/{slug}
  ↓
Cloudflare Worker (k-r2-router veya yeni inject worker)
  ↓
R2: k/{slug}.html (SPE gövde — statik)
  ↓
Worker: discovery bloğu inject
  seed = hash(slug + weekNumber)
  3-4 /k/ URL seç (7919 step)
  ↓
Response: gövde + dinamik footer
Cache-Control:
  gövde: immutable (R2)
  discovery: no-cache veya max-age=604800 (1 hafta)
```

### D.2 Link bloğu HTML yapısı (konsept)

```html
<!-- STATIC: SPE content ends here -->

<section id="discovery-rotate" data-seed-week="2026-W26">
  <h2>Explore Related Scenarios</h2>
  <ul>
    <!-- Worker injects 4 links, changes weekly -->
    <li><a href="/k/{slug-a}" rel="related">...</a></li>
    ...
  </ul>
</section>

<!-- STATIC: footer, schema, etc. -->
```

### D.3 Rotasyon seed formülü

```javascript
weekNumber = Math.floor(Date.now() / 604800000)
discoverySeed = hashString(slug + '-' + weekNumber)
for (i = 0; i < 4; i++) {
  index = (discoverySeed + i * 7919) % TOTAL_POSSIBLE
  slug = getSlugByIndex(index)
  if (slug !== currentSlug) links.push(slug)
}
```

### D.4 Maliyet kontrolü

| Yaklaşım | Worker invocation | Öneri |
|----------|-------------------|-------|
| Full dynamic HTML | Her request | Pahalı |
| R2 serve + inject footer | Her request | **Orta — önerilen** |
| Haftalık R2 re-upload | Batch | Ucuz ama yavaş |
| Sadece Googlebot'a inject | Bot detect | Riskli (cloaking algısı) |

**Kural:** Tüm crawler'lara aynı inject — cloaking yok.

---

## Ek E — SPE Katman Implementasyon Sırası

| Sıra | Katman | Bağımlılık | Tahmini süre |
|------|--------|------------|--------------|
| 1 | Katman 3 (intent operation) | Mevcut intentExamples genişlet | 1–2 hafta |
| 2 | Katman 2 (scenario fixture) | Katman 3 | 1 hafta |
| 3 | Katman 1 (tool deep-dive) | Tool registry | 2 hafta |
| 4 | Katman 4 (audience workflow) | Yeni data file | 2 hafta |
| 5 | Katman 5 (task troubleshooting) | Yeni data file | 2 hafta |
| 6 | Katman 6 (modifier full rewrite) | Katman 4+5 | 3–4 hafta |
| 7 | Katman 7 (tool pre-fill) | Tool URL param desteği | 2 hafta |
| 8 | Quality score yeniden kalibre | Tüm katmanlar | 1 hafta |

**Toplam SPE:** ~14–18 hafta (Faz 0–2 ile paralel).

---

## Ek F — 20 Audience Listesi (Katman 4 Referans)

Programmatic pipeline'daki 20 audience rolü — her biri farklı workflow narrative:

1. devops-engineer
2. cloud-architect
3. backend-engineer
4. frontend-developer
5. fullstack-developer
6. security-analyst
7. site-reliability-engineer
8. platform-engineer
9. data-engineer
10. ml-engineer
11. mobile-developer
12. qa-engineer
13. release-engineer
14. infrastructure-engineer
15. network-engineer
16. database-administrator
17. technical-writer
18. engineering-manager
19. startup-founder
20. open-source-maintainer

Her audience için SPE: farklı intro tonu, farklı step sırası, farklı pitfalls, farklı FAQ.

---

## Ek G — 16 Task Listesi (Katman 5 Referans)

1. debug-production-issue
2. prepare-query-parameters
3. migrate-legacy-system
4. document-api-endpoint
5. audit-security-controls
6. optimize-performance
7. validate-input-data
8. troubleshoot-encoding-mismatch
9. compare-configuration-versions
10. automate-repetitive-workflow
11. test-edge-case-scenarios
12. prepare-deployment-artifacts
13. review-code-changes
14. integrate-third-party-service
15. handle-incident-response
16. plan-capacity-scaling

Her task için SPE: troubleshooting decision tree (5–8 düğüm).

---

## Ek H — 162 Modifier Yapısı

```
modifierIndex = globalIndex % 162

executionStyleIndex = floor(modifierIndex / 18)   → 0..8  (9 style)
deliveryContextIndex = modifierIndex % 18          → 0..17 (18 context)
```

**9 execution style:**

1. without-installing-cli-tools
2. using-browser-only-workflow
3. with-minimal-dependencies
4. in-air-gapped-environment
5. under-strict-compliance-rules
6. with-automated-ci-pipeline
7. during-incident-response
8. for-audit-readiness
9. with-zero-data-retention

**18 delivery context:**

1. for-cost-optimization
2. for-disaster-recovery
3. for-regulatory-compliance
4. for-performance-tuning
5. for-security-hardening
6. for-team-onboarding
7. for-production-rollout
8. for-staging-validation
9. for-client-delivery
10. for-internal-tooling
11. for-legacy-migration
12. for-data-migration
13. for-api-versioning
14. for-multi-tenant-setup
15. for-zero-downtime-deploy
16. for-incident-postmortem
17. for-capacity-planning
18. for-vendor-evaluation

SPE Katman 6: her (style × context) kombinasyonu → farklı steps, FAQ, pitfalls, intro.

---

## Ek I — Bot Audit Checklist (Faz 0 Operasyonel)

Haftalık çalıştırılacak kontrol listesi:

| # | Test | Beklenen | Araç |
|---|------|----------|------|
| 1 | Googlebot UA → 10 rastgele `/k/` slug | 200 + canonical | curl -A Googlebot |
| 2 | Bingbot UA → 10 rastgele `/k/` slug | 200 + canonical | curl -A Bingbot |
| 3 | Google Inspection Tool canlı test | 200 + içerik | GSC |
| 4 | Bing URL Inspection | 200 + içerik | Bing WMT |
| 5 | `/guides/jwt-decoding-browser` | 200 + meta ≥150 char anlamlı | curl |
| 6 | `/tools/regex-tester` | 200 | curl |
| 7 | Bilinmeyen slug | 404 + noindex | curl |
| 8 | 403 yanıt Cache-Control | no-store | response header |
| 9 | Sitemap index erişim | 200 | curl sitemap-index |
| 10 | IndexNow key file | 200 + body=key | curl /{key}.txt |
| 11 | robots.txt Googlebot | Allow / | fetch |
| 12 | Cloudflare WAF log | 0 Googlebot block | dashboard |

---

## Ek J — Glossary (Rapor Terminolojisi)

| Terim | Tanım |
|-------|-------|
| **SPE** | Senaryo Playbook Engine — 7 katmanlı yeni içerik modeli |
| **Template Fill** | Mevcut şablon doldurma modeli (değiştirilecek) |
| **Editorial Spine** | Guide/tool → `/k/` otorite köprüsü |
| **Sitemap musluğu** | rampSchedule ile kademeli sitemap açılımı |
| **Pure discovery** | %20 rotasyonlu, semantic olmayan keşif linkleri |
| **Gate** | Faz geçişi için minimum KPI eşiği |
| **Mesh** | `/k/` ↔ `/k/` iç link ağı |
| **Ramp Controller** | Tek düğme: sitemap + IndexNow + priority senkron |
| **Scaled content** | Google'ın şablon/tekrarlı pSEO sınıflandırması |
| **Information gain** | Sayfanın benzersiz bilgi katkısı |

---

## Ek K — Diğer Ajan Tavsiyeleri — Final Değerlendirme

| Tavsiye | Doğru mu? | Kodda durum | Aksiyon |
|---------|-----------|-------------|---------|
| SPE yetmez, keşif otomasyonu şart | ✓ | — | Bu rapor |
| Sitemap rampa musluğu | ✓ | Plan var, default 18M | Faz 0 |
| Edge dinamik rotasyon | ✓ | Yok | Faz 2 — **kritik** |
| IndexNow kur | ✓ kısmen | Kurulu, 2K/run | Ayarla |
| IndexNow 10K/gün | ⚠️ | Bulk risk | 2–5K kademeli |
| Indexing API 200/gün | ✓ | Kurulu + cron | Secret doğrula |
| Bot guard / 403 esnet | ✓ | Risk devam | Faz 0 acil |
| Cluster mapping | ✓ | Yok | Faz 1 — **kritik** |
| Saf rastgele link | ✗ | — | %50/%30/%20 semantic |

---

## Ek L — Rapor Tamamlık Kontrol Listesi

| Bölüm | Durum |
|-------|-------|
| Yönetici özeti | ✓ |
| Mevcut mimari envanter | ✓ |
| Canlı site teşhisi | ✓ |
| Kök neden analizi | ✓ |
| 18M koruma stratejisi | ✓ |
| SPE 7 katman detay | ✓ |
| 162 modifier kırpmadan çözüm | ✓ |
| Hibrit keşif motoru | ✓ |
| İç link grafi (mevcut + hedef) | ✓ |
| Keşif otomasyonu envanteri | ✓ |
| 6 fazlı rampa | ✓ |
| 3 kritik eksik detay | ✓ |
| Monetizasyon matematiği | ✓ |
| SEO / E-E-A-T | ✓ |
| Bot / 403 | ✓ |
| Sitemap / IndexNow / Indexing API | ✓ |
| KPI ve gate'ler | ✓ |
| Uygulama yol haritası | ✓ |
| Riskler | ✓ |
| Karar matrisi | ✓ |
| Cluster mapping başlangıç tablosu | ✓ (Ek B) |
| Ramp controller blueprint | ✓ (Ek C) |
| Worker inject mimarisi | ✓ (Ek D) |
| Audience/task/modifier referans | ✓ (Ek F–H) |
| Bot audit checklist | ✓ (Ek I) |
| Diğer ajan değerlendirmesi | ✓ (Ek K) |

---

---

# Ek M — 18M Sayfa İndeksleme Stratejisi: Google ve Bing Neden ve Nasıl Dizine Ekler?

## M.1 — Cloudflare Fonksiyonu Tetiklenmeden Sayfaların Sunulması

Mevcut mimari Cloudflare'in edge cache'ini kullanır. Bir sayfa ilk kez crawl edildiğinde Worker tetiklenir, HTML üretilir ve edge'de cache'lenir. **Sonraki tüm requestler (bot dahil) doğrudan cache'den sunulur — Worker tetiklenmez.**

### Neden Worker tetiklenmez?

1. **Priority tier (~750K sayfa):** Build-time'da statik HTML olarak üretilir. Cloudflare bunları CDN asset olarak sunar — hiçbir zaman Worker çalışmaz.
2. **Long-tail (kalan ~17.3M):** İlk hit'te Worker HTML üretir + `Cache-Control: public, s-maxage=3600, stale-while-revalidate=604800` header'ı ile cache'e yazar. 7 gün boyunca cache'den sunulur. Haftalık discovery rotasyonu sonrası doğal revalidation olur.
3. **Kademeli açılım:** Ramp controller sayesinde sitemap'e aynı anda sadece aktif level kadar URL eklenir. Googlebot sitemap'teki URL'leri keşfeder → ilk crawl'da cache'e girer → sonraki crawl'lar cache hit.

**Sonuç:** 18M sayfanın %99.9'u cache'den sunulur. Worker invocation maliyeti pratikte sıfıra yakındır.

---

## M.2 — Google Sayfaları Neden Dizine Ekler?

Google'ın bir sayfayı dizine eklemesi için 3 temel kriter vardır:

### Kriter 1: Keşfedilebilirlik (Discoverability)

| Mekanizma | Nasıl çalışır | Kapasite |
|-----------|---------------|----------|
| **Sitemap** | Kademeli ramp ile sitemap'e URL eklenir | 500K → 18M (6 faz) |
| **IndexNow** | Yeni/değişen URL'ler anında bildirilir | 2K–5K/run |
| **Google Indexing API** | Yüksek öncelikli URL'ler | 200/gün |
| **İç linkler** | Her sayfa 10 primary + 4-8 discovery link taşır | Mesh ağı |
| **Editorial spine** | 17 guide × 12-24 outbound /k/ linki | Otorite aktarımı |

Google bir URL'yi sitemap'te, IndexNow'da veya başka bir sayfanın linkinde gördüğünde keşfetmiş olur.

### Kriter 2: Crawl Erişimi (Crawlability)

| Kontrol | Durum | Sonuç |
|---------|-------|-------|
| robots.txt | Allow: / | ✓ Tüm botlara açık |
| Bot guard | Googlebot/Bingbot whitelist | ✓ 200 döner |
| Response kodu | 200 + full HTML | ✓ Render edilebilir |
| Canonical | Self-referencing | ✓ Duplicate yok |
| Page speed | Edge cache → <100ms TTFB | ✓ Crawl budget korunur |

### Kriter 3: İçerik Kalitesi (Information Gain)

Bu **en kritik** kriterdir. Google "scaled content" (şablon doldurma) algıladığında indexlemez. SPE bunu çözer:

| SPE Katman | Ne sağlar | Bilgi kazanımı |
|------------|-----------|----------------|
| K1 — Tool deep-dive | Araç-spesifik teknik detay | Unique paragraflar |
| K2 — Scenario fixture | Gerçekçi input/output örneği | Tekrarlanamaz veri |
| K3 — Intent operation | Adım adım işlem | Modifier'a göre değişen steps |
| K4 — Audience workflow | Role-spesifik anlatım | 20 farklı perspektif |
| K5 — Task troubleshooting | Decision tree | Unique sorun çözüm yolları |
| K6 — Modifier rewrite | Style+context combo | 162 farklı tam sayfa varyantı |
| K7 — Tool pre-fill | Interaktif parametre | Kullanıcı değeri |

**Sonuç:** Aynı tool+intent kombinasyonu farklı audience×task×modifier ile tamamen farklı içerik üretir → Google her sayfayı "unique" olarak değerlendirir.

---

## M.3 — Bing Sayfaları Neden Dizine Ekler?

Bing'in indexleme kriterleri Google'a benzer ama bazı farkları vardır:

1. **IndexNow native:** Bing, IndexNow protokolünü Google'dan çok daha agresif kullanır. Bildirim → crawl → index süresi 24-72 saat.
2. **Sitemap önceliği:** Bing WMT'ye submit edilen sitemap'leri hızla işler.
3. **Daha az kalite filtresi:** Bing, Google kadar agresif "scaled content" filtresi uygulamaz. SPE kalitesi Bing için fazlasıyla yeterli.
4. **URL Submission API:** Bing'in günlük quota'sı daha yüksek (10K/gün API ile).

---

## M.4 — 18M Sayfanın Tamamı Dizine Eklenir mi?

### Gerçekçi projeksiyon:

| Zaman | Google indexed | Bing indexed | Toplam exposed |
|-------|---------------|--------------|----------------|
| Ay 0–3 (Faz 0) | 150K–300K | 200K–500K | 500K sitemap |
| Ay 4–8 (Faz 1) | 600K–1.2M | 800K–1.5M | 2M sitemap |
| Ay 9–14 (Faz 2) | 2M–4M | 2.5M–4M | 5M sitemap |
| Ay 15–20 (Faz 3) | 5M–7M | 4M–6M | 9M sitemap |
| Ay 21–28 (Faz 4) | 8M–11M | 6M–9M | 14M sitemap |
| Ay 29–36 (Faz 5-6) | 12M–16M | 9M–14M | 18M sitemap |

**Google hedefi:** 12M–16M (tüm 18M değil — %67-89 indexed ratio gerçekçi)
**Bing hedefi:** 9M–14M (Bing genel olarak daha yavaş ama IndexNow ile yakalar)

### Neden %100 olmaz?

- Google her zaman bir miktar "Discovered – currently not indexed" tutar (crawl budget optimization)
- Bazı modifier kombinasyonları Google'ın "benzer içerik" eşiğine takılabilir
- Bu normal — %67+ indexed ratio sektör ortalamasının üstünde

---

## M.5 — Strateji Nasıl İlerleyecek? (Tam Yol Haritası)

### Faz 0 (Ay 0–3): Temel Altyapı

```
1. Ramp Level 0 aktif: 500K URL sitemap'te
2. Bot guard düzeltildi: Googlebot/Bingbot 200 alıyor
3. Discovery rotasyonu aktif: haftalık link değişimi
4. IndexNow: 2K URL/run bildirim
5. Google Indexing API: 200 URL/gün
6. Haftalık bot audit (Ek I)
```

**Gate:** 150K indexed + %30 ratio → Faz 1'e geç

### Faz 1 (Ay 4–8): Cluster Mapping + Guide Spine

```
1. Ramp Level 1: 2M URL sitemap'e açılır
2. Cluster mapping aktif: guide → /k/ outbound linkler live
3. SPE Katman 3 (intent operation) deploy
4. IndexNow: 2.5K URL/run
5. GSC'de "Crawled – currently not indexed" trendi takip
```

**Gate:** 600K indexed + %40 ratio → Faz 2'ye geç

### Faz 2 (Ay 9–14): Edge Inject + SPE Derinleştirme

```
1. Ramp Level 2: 5M URL
2. Worker inject mimarisi live (Ek D)
3. SPE Katman 2+4 deploy (scenario + audience)
4. Haftalık discovery rotasyonu edge'de inject
5. IndexNow: 3K URL/run
```

**Gate:** 2M indexed + %50 ratio → Faz 3'e geç

### Faz 3 (Ay 15–20): Otorite İnşası

```
1. Ramp Level 3: 9M URL
2. SPE Katman 5+6 deploy (task + modifier full rewrite)
3. 17 → 50 flagship guide genişletme
4. Backlink kampanyası başlat
5. IndexNow: 4K URL/run
```

**Gate:** 5M indexed + %55 ratio → Faz 4'e geç

### Faz 4 (Ay 21–28): Büyük Ölçek

```
1. Ramp Level 4: 14M URL
2. SPE Katman 7 (tool pre-fill) deploy
3. 50 → 120 flagship guide
4. Backlink devam
5. IndexNow: 5K URL/run
```

**Gate:** 8M indexed + %57 ratio → Faz 5'e geç

### Faz 5-6 (Ay 29–36): Tam Kapasite + Bakım

```
1. Ramp Level 5: 18M URL tam açık
2. Quality score re-kalibrasyonu
3. Düşük performanslı cluster'larda SPE iterasyonu
4. Maintenance mode: IndexNow + sitemap rotation
5. Hedef: 12M+ Google indexed
```

---

## M.6 — Google ve Bing Tüm 18M Sayfaya Nasıl Ulaşır?

### Keşif kanalları (multi-signal discovery):

```
                    ┌─────────────────────────────────────┐
                    │         18M /k/ Sayfası              │
                    └─────────────────────────────────────┘
                                    ▲
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
              │  Sitemap   │  │ İç Linkler │  │  Ping API  │
              │ (kademeli) │  │   (mesh)   │  │            │
              └───────────┘  └───────────┘  └───────────┘
                    │               │               │
         ┌─────────┤         ┌─────┤         ┌─────┤
         │         │         │     │         │     │
    sitemap-   sitemap-   /k/→/k/  guide   IndexNow  Google
    priority   programmatic  mesh   spine   2-5K/run  Indexing
    (750K)     (ramp level)  (14 link) (17-120)       API 200/d
```

### Crawl budget optimizasyonu:

1. **Hızlı response:** Edge cache → <100ms TTFB → Googlebot daha çok sayfa crawl edebilir
2. **Clean URL yapısı:** `/k/{slug}` — flat, parametre yok
3. **Canonical doğru:** Self-referencing, duplicate sinyal yok
4. **Internal linking:** Her sayfa ortalama 14 outbound internal link → crawl derinliği artar
5. **Sitemap freshness:** Her deploy'da güncel sitemap, `lastmod` doğru

### İndeksleme kalitesi güvencesi:

1. **SPE 7 katman:** Her sayfa gerçek bilgi kazanımı (information gain) taşır
2. **162 modifier = 162 farklı sayfa:** Aynı konu farklı execution style + delivery context
3. **20 audience × 16 task:** Her kombinasyon farklı intro, steps, FAQ, pitfalls
4. **No template fingerprint:** SPE output Google'ın scaled-content dedektörünü geçer
5. **E-E-A-T sinyalleri:** Tool interaktivite, gerçek kullanım senaryoları, kaynaklar

---

## M.7 — Neden Bu Strateji Çalışır? (Özet)

| Faktör | Açıklama | Etki |
|--------|----------|------|
| **Kademeli açılım** | Google'a aynı anda 18M URL bombardımanı yapılmaz; güven kademeli inşa edilir | Crawl budget korunur |
| **Kalite önce** | Faz 0'da 500K sayfa mükemmel kalitede → Google siteye "güvenilir" der | Index oranı yükselir |
| **Multi-channel keşif** | Sitemap + IndexNow + Indexing API + iç linkler | Hiçbir sayfa "keşfedilmemiş" kalmaz |
| **Edge cache** | Bot'a her zaman hızlı, tutarlı HTML | Crawl budget maximize |
| **SPE unique content** | Her sayfa unique bilgi → "information gain" | Scaled content cezası yok |
| **Gate disiplini** | Sonraki faz ancak mevcut faz %X indexed olduğunda açılır | Kalite düşüşü engellenir |
| **Discovery rotasyonu** | Haftalık link değişimi → yeni crawl path'ler | Orphan sayfa kalmaz |
| **Editorial spine** | Guide'lar /k/ sayfalarına otorite aktarır | PageRank akışı |

---

## M.8 — Sonuç

**18M sayfanın tamamına Google ve Bing ulaşacak mı?**  
→ Evet. Sitemap + IndexNow + iç link mesh + Google Indexing API ile tüm 18M URL keşfedilir.

**Hepsi dizine eklenecek mi?**  
→ Gerçekçi hedef: Google'da 12M–16M (%67–89), Bing'de 9M–14M. %100 hiçbir büyük sitede olmaz.

**Dizine ekleme kriteri nedir?**  
→ Keşfedilebilirlik + Crawl erişimi + Unique içerik. SPE + ramp + multi-channel discovery bu üçünü birden sağlar.

**Cloudflare fonksiyonu tetiklenmeden nasıl?**  
→ Edge cache. İlk hit'te Worker çalışır, sonraki tüm requestler cache'den. Priority tier tamamen statik. Worker maliyeti ≈ 0.

**Strateji nasıl ilerleyecek?**  
→ 6 fazlı gate-disiplinli ramp. Her faz önceki fazın başarısını kanıtlamasını gerektirir. 18–36 ayda tam kapasite.

---

*Bu dokümantasyon DevSolve 18M indeksleme master stratejisinin tam referansıdır.*  
*Formül: SPE (kalite) + Hibrit Keşif (sitemap rampa + mesh) + 3 Kritik Eksik (rotasyon, mapping, musluk) + Mevcut Otomasyon (IndexNow, Indexing API) + Gate-disiplinli 6 Faz = 12M–16M indeks hedefi (18–36 ay).*
