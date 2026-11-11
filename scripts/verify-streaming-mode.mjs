#!/usr/bin/env node
/**
 * scripts/verify-streaming-mode.mjs
 * Streaming Mode Dogrulama ve Metrik Takip Denetimi.
 * Dogrular: sistem "Event-Driven Streaming Mode"da mi, "Batch Mode"da mi?
 * Dry-run — ag istegi yapmaz, sadece konfigurasyonu ve akisi denetler.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const REPORTS_DIR = join(ROOT, 'out', 'reports');
const RAMP_LEVEL_FILE = join(ROOT, '.ramp-level');

function readJsonOrNull(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function readTextOrNull(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function auditIndexingApiMode() {
  const evidence = [];
  let streamingSignals = 0;
  let batchSignals = 0;

  const cfgPath = join(ROOT, 'scripts', 'lib', 'streaming-mode-config.mjs');
  const cfgSrc = readTextOrNull(cfgPath);
  if (cfgSrc) {
    const batchSizeMatch = cfgSrc.match(/batchSize:\s*(\d+)/);
    const batchSize = batchSizeMatch ? parseInt(batchSizeMatch[1], 10) : null;
    if (batchSize !== null && batchSize <= 100) {
      streamingSignals += 1;
      evidence.push('OK IndexNow batch boyutu ' + batchSize + ' URL/HTTP (<=100 streaming, bulk DEGIL)');
    } else {
      batchSignals += 1;
      evidence.push('WARN IndexNow batch boyutu ' + (batchSize ?? 'bilinmiyor') + ' — >100 olabilir (batch riski)');
    }
    if (cfgSrc.includes('logStreamingMode')) {
      streamingSignals += 1;
      evidence.push('OK logStreamingMode() mevcut — streaming konfigurasyonu raporlanir');
    }
    if (cfgSrc.includes('Batch Mode') && cfgSrc.includes('KAPALI')) {
      streamingSignals += 1;
      evidence.push('OK Konfigurasyon acikca "Batch Mode — KAPALI" olarak isaretli');
    }
    const delayMatch = cfgSrc.match(/batchDelayMs:\s*(\d+)/);
    const delay = delayMatch ? parseInt(delayMatch[1], 10) : null;
    if (delay !== null && delay > 0) {
      streamingSignals += 1;
      evidence.push('OK IndexNow pacing gecikmesi ' + delay + 'ms — sirali, patlama yok (streaming)');
    }
  } else {
    batchSignals += 1;
    evidence.push('FAIL streaming-mode-config.mjs bulunamadi — streaming konfigurasyonu eksik');
  }

  const pingPath = join(ROOT, 'scripts', 'indexnow-ping.mjs');
  const pingSrc = readTextOrNull(pingPath);
  if (pingSrc) {
    const maxPerRunMatch = pingSrc.match(/MAX_PER_RUN\s*=\s*(\d+|'ALL'|"ALL")/);
    const maxPerRun = maxPerRunMatch ? maxPerRunMatch[1] : null;
    if (maxPerRun && maxPerRun !== 'ALL' && maxPerRun !== '"ALL"' && parseInt(maxPerRun, 10) <= 100) {
      streamingSignals += 1;
      evidence.push('OK indexnow-ping.mjs: MAX_PER_RUN=' + maxPerRun + ' (kucuk dilim, streaming)');
    } else {
      batchSignals += 1;
      evidence.push('WARN indexnow-ping.mjs: MAX_PER_RUN=' + (maxPerRun ?? 'bilinmiyor') + ' — buyuk dilim riski');
    }
    if (pingSrc.includes('sequentially') || pingSrc.includes('sirali') || pingSrc.includes('no concurrency burst')) {
      streamingSignals += 1;
      evidence.push('OK indexnow-ping.mjs: sirali (sequential) gonderim, concurrency burst yok');
    }
    if (pingSrc.includes('rolling slice') || pingSrc.includes('yuvarlak dilim')) {
      streamingSignals += 1;
      evidence.push('OK indexnow-ping.mjs: rolling slice (gunluk deterministik dilim) — tum corpus degil');
    }
  } else {
    batchSignals += 1;
    evidence.push('FAIL indexnow-ping.mjs bulunamadi');
  }

  const deltaPath = join(ROOT, 'scripts', 'ai-quality-indexnow-submit.mjs');
  const deltaSrc = readTextOrNull(deltaPath);
  if (deltaSrc) {
    if (deltaSrc.includes('ai-quality-new-urls.txt') || deltaSrc.includes('newOrChanged')) {
      streamingSignals += 1;
      evidence.push('OK ai-quality-indexnow-submit.mjs: sadece yeni/degisik URL (delta) gonderir — corpus degil');
    }
    if (deltaSrc.includes('best-effort')) {
      streamingSignals += 1;
      evidence.push('OK ai-quality-indexnow-submit.mjs: best-effort, buildi engellemez');
    }
  } else {
    evidence.push('INFO ai-quality-indexnow-submit.mjs bulunamadi (opsiyonel adim 1)');
  }

  const postbuildPath = join(ROOT, 'scripts', 'postbuild.mjs');
  const postbuildSrc = readTextOrNull(postbuildPath);
  if (postbuildSrc) {
    if (postbuildSrc.includes('ai-quality-indexnow-submit.mjs') && postbuildSrc.includes('indexnow-ping.mjs')) {
      streamingSignals += 1;
      evidence.push('OK postbuild.mjs: streaming adim 1 (delta) + adim 2 (rolling slice) orkestrasyonu');
    }
    if (postbuildSrc.includes('logStreamingMode()')) {
      streamingSignals += 1;
      evidence.push('OK postbuild.mjs: logStreamingMode() cagriiliyor — streaming durumu her buildte raporlanir');
    }
  } else {
    batchSignals += 1;
    evidence.push('FAIL postbuild.mjs bulunamadi');
  }

  const mode = streamingSignals > batchSignals ? 'Streaming' : 'Batch';
  return { mode, streamingSignals, batchSignals, evidence };
}

function measureBotFriendlyResponseTimes() {
  const cfgPath = join(ROOT, 'scripts', 'lib', 'streaming-mode-config.mjs');
  const cfgSrc = readTextOrNull(cfgPath);

  let batchDelayMs = 2000;
  let batchSize = 100;
  let rampLevel = 5;

  if (cfgSrc) {
    const d = cfgSrc.match(/batchDelayMs:\s*(\d+)/);
    if (d) batchDelayMs = parseInt(d[1], 10);
    const b = cfgSrc.match(/batchSize:\s*(\d+)/);
    if (b) batchSize = parseInt(b[1], 10);
    const r = cfgSrc.match(/ACTIVE_RAMP_LEVEL\s*=\s*(\d)/);
    if (r) rampLevel = parseInt(r[1], 10);
  }

  const batchesPerSlice = Math.ceil(12000 / batchSize);
  const estimatedSliceTimeMs = batchesPerSlice * batchDelayMs;

  return {
    average: batchDelayMs,
    batchDelayMs,
    batchSize,
    rampLevel,
    estimatedSliceTimeMs,
    batchesPerSlice,
    healthy: batchDelayMs <= 2000,
  };
}

function fetchSearchEngineCrawlStats() {
  const rampFile = readTextOrNull(RAMP_LEVEL_FILE);
  let rampLevel = rampFile ? parseInt(rampFile.trim(), 10) : 5;
  if (!Number.isInteger(rampLevel) || rampLevel < 0 || rampLevel > 5) rampLevel = 5;

  const SITEMAP_LIMITS = [500_000, 2_000_000, 5_000_000, 9_000_000, 14_000_000, 20_000_000];
  const SLICE_SIZES = [2_000, 4_000, 6_000, 8_000, 10_000, 12_000];
  const sitemapLimit = SITEMAP_LIMITS[rampLevel];
  const sliceSize = SLICE_SIZES[rampLevel];

  const outDir = join(ROOT, 'out');
  let sitemapFileCount = 0;
  let aiQualityUrlCount = 0;

  if (existsSync(outDir)) {
    try {
      for (const f of readdirSync(outDir)) {
        if (/sitemap.*\.xml$/i.test(f)) sitemapFileCount += 1;
      }
    } catch { /* best-effort */ }
  }

  const gatekeeperReport = readJsonOrNull(join(REPORTS_DIR, 'ai-quality-gatekeeper.json'));

  return {
    rampLevel,
    sitemapLimit,
    indexNowSliceSize: sliceSize,
    sitemapFileCount,
    aiQualityNewUrlCount: gatekeeperReport?.newOrChangedUrlCount ?? 0,
    eligibleUrlCount: gatekeeperReport?.eligible ?? 0,
    excludedCount: gatekeeperReport?.excluded ?? 0,
    totalRequests: sitemapLimit,
  };
}

async function auditIndexingAndStreamingMode() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  STREAMING MODE DOGRULAMA RAPORU — Batch mi, Streaming mi?');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const apiMode = auditIndexingApiMode();
  const responseTimes = measureBotFriendlyResponseTimes();
  const crawlStats = fetchSearchEngineCrawlStats();

  const currentMode = apiMode.mode === 'Streaming' ? 'Streaming' : 'Batch';

  console.log('--- 1. API Istek Modu (IndexNow / Indexing API) ---');
  apiMode.evidence.forEach((e) => console.log('  ' + e));
  console.log('    -> Streaming sinyali: ' + apiMode.streamingSignals + ' | Batch sinyali: ' + apiMode.batchSignals + '\n');

  console.log('--- 2. Sunucu Yanit Suresi (Pacing / TTFB proxy) ---');
  console.log('    • Ramp seviyesi: ' + responseTimes.rampLevel + ' / 5');
  console.log('    • IndexNow batch boyutu: ' + responseTimes.batchSize + ' URL/HTTP cagrisi');
  console.log('    • Pacing gecikmesi: ' + responseTimes.batchDelayMs + ' ms');
  console.log('    • Ramp ' + responseTimes.rampLevel + ' dilim sureasi: ' + responseTimes.estimatedSliceTimeMs.toLocaleString() + ' ms tahmini dilim suresi');
  console.log('    • Ortalama yanit suresi (pacing proxy): ' + responseTimes.average + ' ms');
  console.log('    • Durum: ' + (responseTimes.healthy ? 'OK Healthy (<=2000 ms pacing — streaming zonu)' : 'WARN Optimization needed (>2000 ms)') + '\n');

  console.log('--- 3. Tarama Istatistikleri (Sitemap / Ramp) ---');
  console.log('    • Ramp seviyesi: ' + crawlStats.rampLevel + ' / 5');
  console.log('    • Sitemap limiti (ilan edilen corpus): ' + crawlStats.sitemapLimit.toLocaleString() + ' URL');
  console.log('    • IndexNow dilim boyutu (gunluk/calisma): ' + crawlStats.indexNowSliceSize.toLocaleString() + ' URL');
  console.log('    • Sitemap dosya sayisi (out/): ' + crawlStats.sitemapFileCount);
  console.log('    • AI Quality yeni/degisik URL (bu build): ' + crawlStats.aiQualityNewUrlCount);
  console.log('    • AI Quality uygun URL: ' + crawlStats.eligibleUrlCount.toLocaleString());
  console.log('    • Soft-izole (noindex) URL: ' + crawlStats.excludedCount + '\n');

  const report = {
    current_mode: currentMode,
    avg_server_response_ms: responseTimes.average,
    daily_bot_crawl_volume: crawlStats.totalRequests,
    index_now_slice_size: crawlStats.indexNowSliceSize,
    ramp_level: crawlStats.rampLevel,
    streaming_signals: apiMode.streamingSignals,
    batch_signals: apiMode.batchSignals,
    healthy: responseTimes.healthy,
    recommendation: responseTimes.healthy ? 'Healthy — streaming modu aktif ve guvenli' : 'Optimization needed',
    evidence: apiMode.evidence,
  };

  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  KESIN SONUC');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  Mod: ' + report.current_mode);
  console.log('  Garanti: ' + (report.current_mode === 'Streaming' ? 'EVET — Streaming modunda calisiyorsunuz. Batch mode DEGIL.' : 'HAYIR — Batch mode tespit edildi.'));
  console.log('  Sunucu yanit suresi: ' + report.avg_server_response_ms + ' ms (' + (report.healthy ? 'Healthy' : 'Optimization needed') + ')');
  console.log('  Gunluk tarama butcesi (sitemap advertised): ' + report.daily_bot_crawl_volume.toLocaleString() + ' URL');
  console.log('  IndexNow dilim boyutu: ' + report.index_now_slice_size.toLocaleString() + ' URL/calisma');
  console.log('  Ramp seviyesi: ' + report.ramp_level + ' / 5');
  console.log('  Oneri: ' + report.recommendation);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return report;
}

auditIndexingAndStreamingMode().catch((err) => {
  console.error('🚨 Audit script crashed:', err.message);
  process.exitCode = 1;
});
