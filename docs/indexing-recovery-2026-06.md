# DevSolve — Dizine Ekleme Krizi Kurtarma Raporu (2026-06)

**Durum:** Dizine eklenen sayfa sayısı ~100.000 → **8**. Yakın zamanda site saldırıya uğradı
ve "fonksiyon tetiklenmesin" diye aceleyle yapılan güvenlik güncellemeleri devreye alındı.
Bu rapor, Google "Sayfa dizine ekleme raporu" kriterlerine ve kod incelemesine dayanır.

> **Tek cümlelik teşhis:** Sayfalar silinmedi; **Googlebot'un sayfalara erişimi kod
> tarafından yanlışlıkla engellendi (403)** ve geçici bir engel **24 saat boyunca edge'de
> cache'lendi**. Buna ek olarak şüpheli URL'lere **410 (kalıcı silme)** dönülüyordu — bu da
> "geri dönüşü olmayan" bir de-indexleme sinyali. Üçü birden 100k→8 düşüşünü açıklıyor.

---

## 1) Kök neden analizi (GSC nedenleri ile eşleştirme)

| GSC "Neden" satırı | Bu sitedeki gerçek kaynak | Kaynak |
|---|---|---|
| **Erişim izni verilmemesi (403) nedeniyle engellendi** | `isLikelyGooglebot()` Cloudflare `cf.asn` allow-list'inde olmayan her isteği **fail-CLOSED** (`return false`) yapıyordu. Pages Free/Standard planında `request.cf` alanları her zaman dolu gelmez → gerçek Googlebot 403 yedi. | **Web sitesi (düzeltilebilir)** |
| **Sunucu/erişim hatası tekrarlıyor** | 403 yanıtı `Cache-Control: public, max-age=86400` ile dönüyordu → tek bir yanlış engel 24 saat boyunca edge'den tekrar tekrar sunuldu. | **Web sitesi** |
| **Bulunamadı / Soft 404 / kalıcı kaldırma** | Çözülemeyen ama "gramer olarak geçerli" slug'lara **HTTP 410** dönülüyordu. 410 = *kalıcı yok*. Resolver/sitemap drift'i tek bir hata gerçek sayfaları kalıcı sildi. | **Web sitesi** |
| **Kopya / Google farklı standart sayfa seçti** | 162 "modifier" boyutu, aynı çekirdek (cluster×tool×intent×audience×task) için **neredeyse aynı** 162 sayfa üretiyor; sadece tek bir ifade değişiyor → "scaled content / duplicate" kümesi. | **Web sitesi** |
| **Tarandı – şu anda dizine eklenmedi / Bulundu – dizine eklenmedi** | Yukarıdaki kalite + crawl-budget baskısı. 18M düşük-farklılaşmış URL, kalite eşiğini geçemiyor. | **Web sitesi** |

---

## 2) ŞİMDİ uygulanan kod düzeltmeleri (kanıtlanmış, geri-alınabilir)

Hedef dosya: `functions/k/[[slug]].ts`
Uygulayıcı (idempotent): `scripts/apply-indexing-fixes.mjs` — yeniden çalıştırmak güvenli,
çift uygulamaz (uygulanmış adımları `[SKIPPED]` der).

1. **`botguard-fail-open`** — `isLikelyGooglebot()` artık ASN bilinmiyorsa `false` yerine
   `null` ("doğrulanamadı") döner ve `decideAccess` isteği **ALLOW** eder. Sahte bir
   Googlebot UA yalnızca ucuz, deterministik, cache'li bir sayfa görür — gerçek bir
   saldırı yüzeyi değil. Yanlış-engel ise indexlemeyi yok ediyordu. (**fail-OPEN**)
2. **`access-denied-403-no-store`** — 403 artık `Cache-Control: no-store`. Geçici bir
   mis-block 24 saat değil, anında düzelir.
3. **`unresolved-shape-valid-410-to-404`** — gramer-geçerli ama çözülemeyen slug artık
   **410 yerine 404** (kurtarılabilir) + kısa edge cache. (Gerçek çöp — aşırı uzunluk/regex
   hatası — hâlâ 410, çünkü en hızlı temizlenen odur.)
4. **`unresolved-shape-valid-cache-shorten`** — negatif yanıt cache'i 24h → ~1h.
5. **`add-workedexample-builder` + `place-workedexample`** — **kopya içerik panzehiri**
   (aşağıda §3).

> Çalıştır: `node scripts/apply-indexing-fixes.mjs`

---

## 3) Kopya/tekrarlı içerik sorunu — gerçek panzehir

**Tespitiniz doğru:** sayfalar yapısal olarak birbirini tekrar ediyor. Asıl sebep
**162-modifier boyutu**: aynı çekirdek için 162 sayfa, sadece tek ifade farkıyla üretiliyor.
Google bunları kümeleyip **tek bir standart (canonical)** seçer; gerisi "Kopya — Google
farklı standart seçti" olur.

**Uygulanan kod çözümü:** her sayfaya **slug'a özgü, deterministik bir "Worked Example"**
bölümü eklendi (`sectionBuilders.workedexample`). Fixture id, alan adları, kayıt numarası
ve anlatı tamamen slug hash'inden türetilir (modifier başına farklı) → **18M sayfanın
hiçbiri bu bloğu paylaşmaz**. Bu, yeniden-ifade edilmiş kalıp değil, gerçek **bilgi
kazancı (information-gain)** ekler ve kardeş sayfaları içerik düzeyinde ayrıştırır.

### Dürüst gerçek (kritik karar)
> **18 milyon "neredeyse aynı" sayfanın tamamı asla dizine eklenmez** — bu, Google'ın
> "scaled content abuse" politikasının tanımıdır. İki seçenek var:

- **A) Kaliteyi yükselt, korpüsü koru:** §3 worked-example + daha büyük rotasyon havuzları
  ile her sayfayı gerçekten farklılaştır. Yine de Google muhtemelen yalnızca en güçlü
  alt kümeyi indeksler.
- **B) (ÖNERİLEN) Korpüsü küçült + canonical birleştir:** sitemap'e modifier boyutunu
  *tek* temsilci ile yaz (18M → ~110k yüksek-kaliteli çekirdek sayfa) ve modifier
  varyantlarında `<link rel="canonical">` çekirdeğe işaret etsin. Bu, Google'ın "18M URL'i
  indeksle" isteğini gerçeğe çevirir: **az ama indekslenen** > **çok ama indekslenmeyen.**

> Karar sizin: 18M sayıyı korumak istiyorsanız (A), gerçek SEO kazancı için (B) — ya da
> faz faz: önce (B) ile krizi durdur, sonra (A) ile korpüsü kademeli aç.

### Karar: 18M korunuyor (varsayılan geri alındı)
> Site sahibinin tercihi üzerine `PROGRAMMATIC_SITEMAP_LIMIT` varsayılanı tekrar
> **18.040.320** (tam korpüs). Korpüsü küçültmek **opsiyonel** ve sadece env ile yapılır;
> kod değişmez:
> - `PROGRAMMATIC_SITEMAP_LIMIT=4000000` → 4M
> - `PROGRAMMATIC_SITEMAP_LIMIT=110000` → 110k (en muhafazakâr)
>
> ⚠️ Dürüst uyarı: 18M URL'i **sitemap'e koymak** ile Google'ın bunları **dizine eklemesi**
> ayrı şeylerdir. Sayfa sayısını artırmak indekslenmeyi artırmaz; gerçek kazanç §2 (erişim)
> + §3 (worked-example farklılaştırma) + iç-link/otorite ile gelir.

---

### "110k" tam olarak ne demek? (açıklama)
Korpüs şu çarpımdan üretiliyor (`generate-programmatic-sitemaps.mjs`):

```
cluster×tool×intent (toplam ~30 çekirdek kombinasyon başına)
  × audience (20)
  × task (16)
  × modifier (9 execution-style × 18 delivery-context = 162)
```

- **Modifier boyutu (162)** her çekirdek sayfayı **162 kez** kopyalıyor; aralarındaki tek
  fark tek bir ifade (ör. "for-audit-readiness" ↔ "for-cost-optimization"). Google için
  bu 162 sayfa **neredeyse birbirinin aynısı** = kopya kümesi.
- Eğer **modifier'ı URL'den çıkarıp** her çekirdeği **tek** temsilci sayfa olarak yazarsan:
  `18.040.320 ÷ 162 ≈ 111.000` → işte **"110k"** budur. Yani **18M'in modifier'sız,
  benzersiz çekirdek hâli.**
- "B planı"nda 162 varyant silinmez; sadece **sitemap'e tek temsilci** girer ve diğer 161
  varyant `<link rel="canonical">` ile o temsilciye işaret eder. Böylece Google "kopya"
  yerine "tek güçlü sayfa" görür.

> Özetle: **18M = her şey dahil**, **110k = modifier'sız benzersiz çekirdek**, **4M = ikisi
> arası ayar**. Üçü de aynı koddan, sadece `PROGRAMMATIC_SITEMAP_LIMIT` (ve canonical
> stratejisi) ile elde edilir. Şu an varsayılan **18M**.



---

## 4) Google Search Console aksiyon listesi (sırayla)

1. **robots.txt + canlı test:** `/k/<örnek-slug>` için **URL Denetleme → Canlı URL'yi test
   et**. Artık **200** dönmeli (403 değil). "Test edilen sayfayı göster" ile içeriği gör.
2. Deploy sonrası **Doğrulamayı Başlat**: "403 ile engellendi" ve "410/Bulunamadı"
   satırlarında **Düzeltmeyi Doğrula**.
3. **Öncelikli sitemap:** yalnızca en değerli ~birkaç bin çekirdek sayfayı içeren küçük bir
   sitemap gönder; doğrulamayı bu sitemap'e göre filtrele (uzman ipucu — daha hızlı onay).
   **Önemli:** artık eski `sitemap-index.xml` değil, **yeni sürümlü**
   `sitemap-index-2026-06-v2.xml` URL'sini gönder (bkz. §6).

4. **Kademeli artış bekle:** indexleme günler/haftalar sürer; ani %100 bekleme.
5. **Crawl budget:** 18M URL'de Google'ı çekirdek sayfalara yönlendir (sitemap + internal
   link matrisi + canonical). Düşük değerli kuyruğu `noindex,follow` ile besle.

---

## 5) Tekrarı önleme (drift guard)

- 410 yalnızca *gerçekten imkânsız* girdiler için; çözülebilir slug'lar **asla** 410 almamalı.
- Bot-guard **fail-open** kalmalı (yanlış-engelin maliyeti > sahte-bot maliyeti).
- Hiçbir 4xx/5xx **uzun süreli cache'lenmemeli** (`no-store` veya kısa s-maxage).
- CI'da: rastgele 50 örnek slug'ın 200 döndüğünü ve canonical/`<title>` üretildiğini doğrulayan
  bir smoke-test ekleyin (saldırı sonrası "aceleyle eklenen guard"ların regresyonunu yakalar).

---

## 6) Sürümlü sitemap-index ("donmuş sitemap" çözümü)

**Belirti:** GSC'de sitemap-index gönderiliyor ama alt-sitemap'ler **"0 keşfedildi / 0
dizine eklendi"** olarak donup kalıyor; kaç kez yeniden gönderirsen gönder değişmiyor.
Bunun nedeni Google'ın eski `sitemap-index.xml` URL'sinin **bayat (stale) parse'ını**
tekrar oynatmasıdır — yeni bir keşif turu başlatmaz.

**Çözüm (uygulandı):** sitemap-index artık **sürümlü ve env ile ayarlanabilir** bir ad
altında yayınlanıyor:

- `scripts/generate-programmatic-sitemaps.mjs` → `SITEMAP_INDEX_NAME`
  (varsayılan `sitemap-index-2026-06-v2.xml`, env ile override edilebilir).
- Build sırasında **eski `sitemap-index*.xml` dosyaları silinir**
  (`removeStaleSitemapIndexes()`), böylece eski URL **404** döner → Google bayat parse'ı
  bırakır ve yeni URL'yi taze kaynak olarak işler.
- `public/robots.txt` içindeki `Sitemap:` satırı yeni ada güncellendi.

**Aksiyon:** Her "donma" tekrarında **versiyon son ekini artır** (ör. `-v3`) veya
`SITEMAP_INDEX_NAME` env değişkenini değiştir; deploy et; GSC → Site Haritaları'nda **yeni
URL'yi gönder**, eskisini **kaldır**. Build logu doğru URL'yi yazdırır:
`→ submit this exact URL in GSC: https://devsolvev2.com/<yeni-ad>`.

> Not: 18M ↔ ~110k tartışması (§3) ayrı bir karardır. Sitemap adını değiştirmek **keşif**
> sorununu çözer; **dizine ekleme** ise hâlâ §2 (erişim) + §3 (kopya/kalite) düzeltmelerine
> bağlıdır. İkisi birlikte uygulanmalıdır.

---

### Ek: "Saldırı sonrası güncelleme" notu

Saldırıya tepki olarak eklenen sert bot-guard tam da indekslemeyi öldüren parçaydı.
Yukarıdaki fail-open + no-store değişiklikleri güvenliği **bozmaz**: sahte Googlebot yalnızca
statik, hesaplaması ucuz, edge-cache'li bir sayfa görür; gerçek koruma (rate-limit, WAF,
edge cache) yerinde kalır.


---

## 7) Güncelleme (2026-06): Modifier başına "Execution Context" bölümü + çeşitlendirilmiş öncelikli sitemap

Site sahibinin kararı nettir: **korpüs 110k'ya düşürülmez; ~18M sayfanın tamamına
yakınının dizine eklenmesi hedeflenir.** Bu hedefe modifier tekrarını *içerik
kalitesini artırarak* (Google'ı kandırmadan, sahte içerik basmadan) ve Cloudflare
fonksiyonunu fazladan tetiklemeden yaklaşıyoruz.

**Ne yapıldı (`functions/k/[[slug]].ts`):**
- 162 modifier = 9 *execution style* (NASIL çalıştırılıyor) × 18 *delivery context*
  (HANGİ iş çıktısı için). Her execution style ve her delivery context için
  **gerçek, birbirinden farklı** bilgi profili tablosu eklendi
  (`MODIFIER_EXECUTION_PROFILES`, `MODIFIER_DELIVERY_PROFILES`): mekanik, dürüst
  ödünleşim, neyin doğrulanacağı, kimin umursadığı, üretilen kanıt, kaçınılan risk.
- Yeni **`executioncontext`** bölümü `splitModifier()` ile slug'daki modifier'ı iki
  yarısına ayırır ve bu profilleri birleştirerek her sayfaya modifier'a özgü, çok
  paragraflı, faydalı içerik üretir. Aynı çekirdeğin 162 kardeş sayfası artık tek bir
  ifadeyle değil, **bütün bir bölümle** ayrışır → "scaled content / Google farklı
  canonical seçti" sinyali içerik düzeyinde kırılır.
- Tamamen deterministik: statik tablolar üzerinde, aynı render geçişinde zaten
  hesaplanmış değerlerle string interpolasyonu. Ek fetch / I-O **yok**; sayfa
  `s-maxage=31536000, immutable` ile edge'de cache'lenmeye devam eder, dolayısıyla
  fonksiyon ek iş yapmaz ve **fazladan tetiklenmez**.
- Doğrulandı (yerel render harness): tek çekirdeğin 162 modifier varyantı →
  **162/162 benzersiz** Execution Context bölümü ve başlığı; sayfa başına ~+290 kelime.

**Crawl stratejisi (`scripts/generate-priority-sitemap.mjs`):**
- Öncelikli ("taze tier") sitemap'in modifier seçimi "ilk 24" yerine **9 execution
  style'ın hepsinden 3'er iyi dağıtılmış delivery context** içeren çeşitli bir örnekle
  değiştirildi (`PRIORITY_MODIFIER_INDICES`). Böylece Google'ın hızlı taradığı örnek,
  modifier çeşitliliğinin tamamını temsil eder (eskiden yalnızca ilk 2 execution style
  görünür, bu da "hepsi aynı" izlenimini pekiştirirdi).
- **Korpüs küçülmez:** ana sitemap hâlâ 18.040.320 URL ilan eder; bu değişiklik yalnızca
  *hangi* yüksek-değerli sayfaların öncelikli taze `lastmod` aldığını değiştirir.
