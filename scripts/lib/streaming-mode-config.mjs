/**
 * scripts/lib/streaming-mode-config.mjs
 * ============================================================================
 * Event-Driven Streaming Mode — unified configuration.
 *
 * Bu modül, "batch mode" yerine "Event-Driven Streaming Mode" geçişinin tek
 * kaynak niteliğindeki konfigürasyonudur. Tüm IndexNow / sitemap / crawl-budget
 * akışları buradan okunur; hardcoded değerler yoktur.
 *
 * Ramp seviyesine (`.ramp-level` dosyası veya PROGRAMMATIC_RAMP_LEVEL env var)
 * bağlı olarak IndexNow parça boyutu, batch boyutu ve pacing gecikmesi
 * ayarlanır. Böylece ramp 0 (500K) ve ramp 5 (20M) arasında akış gövdesi
 * otomatik olarak escala eder.
 *
 * Çalışma zamanında TypeScript'e (rampController.ts) bağımlı olmayarak
 * doğrudan .mjs ortamında çalışır; .ramp-level dosyasını okur ve
 * rampController.ts ile aynı değerleri üretir.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const RAMP_LEVEL_FILE = join(ROOT, '.ramp-level');

// RAMP_SCHEDULE — src/config/rampController.ts ile aynı değerler.
// Düzenleme yaparken her iki dosyayı da senkronize tutun.
export const RAMP_SCHEDULE = [500_000, 2_000_000, 5_000_000, 9_000_000, 14_000_000, 20_000_000];

// IndexNow ayarları per ramp level (src/config/rampController.ts ile aynı)
const INDEXNOW_LEVEL_CONFIG = [
  { level: 0, sliceSize: 2_000, batchSize: 100, batchDelayMs: 2_000 },   // Faz 0 — 500K
  { level: 1, sliceSize: 4_000, batchSize: 100, batchDelayMs: 2_000 },   // Faz 1 — 2M
  { level: 2, sliceSize: 6_000, batchSize: 100, batchDelayMs: 2_000 },   // Faz 2 — 5M
  { level: 3, sliceSize: 8_000, batchSize: 100, batchDelayMs: 1_500 },   // Faz 3 — 9M
  { level: 4, sliceSize: 10_000, batchSize: 100, batchDelayMs: 1_000 },  // Faz 4 — 14M
  { level: 5, sliceSize: 12_000, batchSize: 100, batchDelayMs: 1_000 },  // Faz 5 — 20M
];

function readRampLevel() {
  // 1. Environment override
  const env = process.env.PROGRAMMATIC_RAMP_LEVEL;
  if (env !== undefined) {
    const n = Number.parseInt(env, 10);
    if (Number.isInteger(n) && n >= 0 && n <= 5) return n;
  }
  // 2. .ramp-level file (CI auto-updated, build-time read)
  try {
    const raw = readFileSync(RAMP_LEVEL_FILE, 'utf8').trim();
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 0 && n <= 5) return n;
  } catch { /* file missing — fall through */ }
  // 3. Fallback = 5 (full 20M)
  return 5;
}

export const ACTIVE_RAMP_LEVEL = readRampLevel();

export function getActiveRampConfig() {
  return INDEXNOW_LEVEL_CONFIG[ACTIVE_RAMP_LEVEL];
}

export function getIndexNowConfig() {
  const cfg = getActiveRampConfig();
  return {
    sliceSize: cfg.sliceSize,
    batchSize: cfg.batchSize,
    batchDelayMs: cfg.batchDelayMs,
    rampLevel: ACTIVE_RAMP_LEVEL,
    sitemapLimit: RAMP_SCHEDULE[ACTIVE_RAMP_LEVEL],
  };
}

export function logStreamingMode() {
  const cfg = getIndexNowConfig();
  console.log('──────────────────────────────────────────────────────────────');
  console.log('🌊 Event-Driven Streaming Mode — aktif konfigürasyon');
  console.log(`   Ramp seviyesi:        ${cfg.rampLevel} / 5`);
  console.log(`   Sitemap limiti:       ${cfg.sitemapLimit.toLocaleString()} URL`);
  console.log(`   IndexNow dilim boyutu: ${cfg.sliceSize.toLocaleString()} URL/çalıştırma`);
  console.log(`   IndexNow batch boyutu: ${cfg.batchSize.toLocaleString()} URL/HTTP`);
  console.log(`   IndexNow pacing:      ${cfg.batchDelayMs} ms aralık`);
  console.log('   Mod:                  Event-Driven (delta-only, küçük parçalar, sıralı)');
  console.log('   Karşıt:               Batch Mode (tüm corpus tek seferde) — KAPALI');
  console.log('──────────────────────────────────────────────────────────────');
}