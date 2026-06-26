/**
 * ============================================================================
 * UNIFIED RAMP CONTROLLER — EKSİK #3
 * ============================================================================
 *
 * Single source of truth for the programmatic sitemap ramp schedule.
 * Controls: sitemap URL limit, IndexNow slice source, priority tier scope,
 * and R2 upload batch priority — all from ONE ramp level number.
 *
 * Gate rules: Each level has entry criteria (indexed ratio, crawled-not-indexed
 * ratio). Do NOT advance rampLevel until gate metrics are met in GSC.
 *
 * IMPORTANT: This file is read at BUILD TIME by scripts and at RUNTIME by
 * the edge function. Do NOT import heavy dependencies here.
 */

import { siteConfig } from './site';

// ---------------------------------------------------------------------------
// Ramp Level Definitions
// ---------------------------------------------------------------------------

export type RampLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface RampLevelConfig {
  /** Ramp level index */
  level: RampLevel;
  /** Maximum URLs to include in programmatic sitemaps */
  sitemapLimit: number;
  /** IndexNow rolling slice size per run */
  indexNowSliceSize: number;
  /** IndexNow batch size per HTTP call */
  indexNowBatchSize: number;
  /** Delay between IndexNow batches (ms) */
  indexNowBatchDelay: number;
  /** Google Indexing API daily submission cap */
  indexingApiDailyQuota: number;
  /** Minimum indexed/sitemap ratio to advance to next level */
  gateIndexedRatio: number;
  /** Maximum crawled-not-indexed ratio allowed */
  gateCrawledNotIndexedMax: number;
  /** Minimum monthly impressions to advance */
  gateMinImpressions: number;
  /** Sitemap changefreq for bulk tier */
  bulkChangefreq: 'daily' | 'weekly' | 'monthly';
  /** Description for logging */
  description: string;
}

/**
 * Phase gate definitions — each level has entry criteria.
 * Advance ONLY when the previous level's gate metrics are satisfied.
 */
export const RAMP_LEVELS: readonly RampLevelConfig[] = [
  {
    level: 0,
    sitemapLimit: 500_000,
    indexNowSliceSize: 2_000,
    indexNowBatchSize: 100,
    indexNowBatchDelay: 2_000,
    indexingApiDailyQuota: 200,
    gateIndexedRatio: 0.30,
    gateCrawledNotIndexedMax: 0.55,
    gateMinImpressions: 10_000,
    bulkChangefreq: 'weekly',
    description: 'Faz 0 — Foundation (500K sitemap, prove quality)',
  },
  {
    level: 1,
    sitemapLimit: 2_000_000,
    indexNowSliceSize: 4_000,
    indexNowBatchSize: 100,
    indexNowBatchDelay: 2_000,
    indexingApiDailyQuota: 200,
    gateIndexedRatio: 0.40,
    gateCrawledNotIndexedMax: 0.50,
    gateMinImpressions: 100_000,
    bulkChangefreq: 'weekly',
    description: 'Faz 1 — SPE Full + Editorial Spine (2M sitemap)',
  },
  {
    level: 2,
    sitemapLimit: 5_000_000,
    indexNowSliceSize: 6_000,
    indexNowBatchSize: 100,
    indexNowBatchDelay: 1_500,
    indexingApiDailyQuota: 200,
    gateIndexedRatio: 0.50,
    gateCrawledNotIndexedMax: 0.45,
    gateMinImpressions: 1_000_000,
    bulkChangefreq: 'weekly',
    description: 'Faz 2 — Crawl Mesh + Dynamic Rotation (5M sitemap)',
  },
  {
    level: 3,
    sitemapLimit: 9_000_000,
    indexNowSliceSize: 8_000,
    indexNowBatchSize: 100,
    indexNowBatchDelay: 1_500,
    indexingApiDailyQuota: 200,
    gateIndexedRatio: 0.55,
    gateCrawledNotIndexedMax: 0.45,
    gateMinImpressions: 5_000_000,
    bulkChangefreq: 'monthly',
    description: 'Faz 3 — Authority Building (9M sitemap)',
  },
  {
    level: 4,
    sitemapLimit: 14_000_000,
    indexNowSliceSize: 10_000,
    indexNowBatchSize: 100,
    indexNowBatchDelay: 1_000,
    indexingApiDailyQuota: 200,
    gateIndexedRatio: 0.57,
    gateCrawledNotIndexedMax: 0.40,
    gateMinImpressions: 20_000_000,
    bulkChangefreq: 'monthly',
    description: 'Faz 4 — Expansion (14M sitemap)',
  },
  {
    level: 5,
    sitemapLimit: 18_040_320,
    indexNowSliceSize: 10_000,
    indexNowBatchSize: 100,
    indexNowBatchDelay: 1_000,
    indexingApiDailyQuota: 200,
    gateIndexedRatio: 0.67,
    gateCrawledNotIndexedMax: 0.35,
    gateMinImpressions: 50_000_000,
    bulkChangefreq: 'monthly',
    description: 'Faz 5 — Full Corpus (18M sitemap, target 12-16M indexed)',
  },
] as const;

// ---------------------------------------------------------------------------
// Active Ramp Level Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the current active ramp level.
 *
 * Priority order:
 * 1. PROGRAMMATIC_RAMP_LEVEL env var (explicit override)
 * 2. monetization.opsFlags.programmaticRampLevel (config file)
 * 3. Default: 0 (start conservative)
 *
 * NOTE: In Faz 0 we START at level 0 (500K). The default was previously
 * level 5 (18M wide open) — this is the "musluk kapatma" fix.
 */
export function resolveRampLevel(): RampLevel {
  const envLevel = process.env.PROGRAMMATIC_RAMP_LEVEL;
  if (envLevel !== undefined) {
    const parsed = parseInt(envLevel, 10);
    if (parsed >= 0 && parsed <= 5) return parsed as RampLevel;
  }

  // Default to 0 — conservative start (500K)
  // To advance, set PROGRAMMATIC_RAMP_LEVEL=1 after gate metrics are met
  return 0;
}

/**
 * Get the configuration for the current active ramp level.
 */
export function getActiveRampConfig(): RampLevelConfig {
  const level = resolveRampLevel();
  return RAMP_LEVELS[level];
}

/**
 * Get the sitemap limit for the current ramp level.
 * This replaces the raw PROGRAMMATIC_SITEMAP_LIMIT env var.
 */
export function getRampSitemapLimit(): number {
  // Allow explicit env override for backward compatibility
  const envLimit = process.env.PROGRAMMATIC_SITEMAP_LIMIT;
  if (envLimit !== undefined) {
    const parsed = parseInt(envLimit, 10);
    if (parsed > 0 && parsed <= siteConfig.programmatic.targetTotal) return parsed;
  }
  return getActiveRampConfig().sitemapLimit;
}

/**
 * Get IndexNow configuration for the current ramp level.
 */
export function getIndexNowConfig(): {
  sliceSize: number;
  batchSize: number;
  batchDelay: number;
} {
  const config = getActiveRampConfig();
  return {
    sliceSize: config.indexNowSliceSize,
    batchSize: config.indexNowBatchSize,
    batchDelay: config.indexNowBatchDelay,
  };
}

/**
 * Log current ramp status for build/deploy diagnostics.
 */
export function logRampStatus(): void {
  const config = getActiveRampConfig();
  console.log(`\n[Ramp Controller] Active: Level ${config.level} — ${config.description}`);
  console.log(`  Sitemap limit: ${config.sitemapLimit.toLocaleString()} URLs`);
  console.log(`  IndexNow slice: ${config.indexNowSliceSize.toLocaleString()} URLs/run`);
  console.log(`  Gate to next level: indexed ratio ≥${(config.gateIndexedRatio * 100).toFixed(0)}%, CNI ≤${(config.gateCrawledNotIndexedMax * 100).toFixed(0)}%`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Sitemap Tier Configuration (per ramp level)
// ---------------------------------------------------------------------------

export interface SitemapTier {
  name: string;
  startIndex: number;
  endIndex: number;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

/**
 * Calculate sitemap tiers for the current ramp level.
 * Higher tiers get higher priority and fresher changefreq.
 */
export function getSitemapTiers(): SitemapTier[] {
  const limit = getRampSitemapLimit();

  if (limit <= 500_000) {
    return [
      { name: 'priority', startIndex: 0, endIndex: Math.min(200_000, limit), changefreq: 'daily', priority: 1.0 },
      { name: 'tier-2', startIndex: 200_000, endIndex: limit, changefreq: 'weekly', priority: 0.8 },
    ];
  }

  if (limit <= 2_000_000) {
    return [
      { name: 'priority', startIndex: 0, endIndex: 200_000, changefreq: 'daily', priority: 1.0 },
      { name: 'tier-2', startIndex: 200_000, endIndex: 1_200_000, changefreq: 'weekly', priority: 0.8 },
      { name: 'tier-3', startIndex: 1_200_000, endIndex: limit, changefreq: 'weekly', priority: 0.7 },
    ];
  }

  if (limit <= 9_000_000) {
    return [
      { name: 'priority', startIndex: 0, endIndex: 200_000, changefreq: 'daily', priority: 1.0 },
      { name: 'tier-2', startIndex: 200_000, endIndex: 1_200_000, changefreq: 'weekly', priority: 0.8 },
      { name: 'tier-3', startIndex: 1_200_000, endIndex: 5_000_000, changefreq: 'weekly', priority: 0.7 },
      { name: 'tier-4', startIndex: 5_000_000, endIndex: limit, changefreq: 'monthly', priority: 0.6 },
    ];
  }

  // Full corpus (9M+)
  return [
    { name: 'priority', startIndex: 0, endIndex: 200_000, changefreq: 'daily', priority: 1.0 },
    { name: 'tier-2', startIndex: 200_000, endIndex: 1_200_000, changefreq: 'weekly', priority: 0.8 },
    { name: 'tier-3', startIndex: 1_200_000, endIndex: 5_000_000, changefreq: 'weekly', priority: 0.7 },
    { name: 'tier-4', startIndex: 5_000_000, endIndex: 9_000_000, changefreq: 'monthly', priority: 0.6 },
    { name: 'tier-5', startIndex: 9_000_000, endIndex: 14_000_000, changefreq: 'monthly', priority: 0.5 },
    { name: 'tier-6', startIndex: 14_000_000, endIndex: limit, changefreq: 'monthly', priority: 0.5 },
  ];
}
