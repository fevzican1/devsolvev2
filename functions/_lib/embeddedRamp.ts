/**
 * Edge-embedded ramp level — MUST stay in lockstep with /.ramp-level.
 *
 * The weekly Ramp Auto-Advance workflow updates BOTH files when GSC gates pass.
 * The edge sitemap advertises RAMP_SITEMAP_LIMITS[EMBEDDED_RAMP_LEVEL] URLs so
 * crawl budget tracks the ramp (never the full 20M until level 5).
 *
 * Do not hand-edit without also updating /.ramp-level (verify-ramp-sitemap-sync).
 */
export const EMBEDDED_RAMP_LEVEL = 0 as 0 | 1 | 2 | 3 | 4 | 5;
