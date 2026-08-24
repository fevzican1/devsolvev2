/**
 * Edge-embedded corpus size lock — MUST stay in lockstep with /.ramp-level.
 *
 * Level 5 = the full 20M sitemap. Staged 2M/5M/9M bands are retired.
 * Neighbour uniqueness + the edge quality gate are what keep Google/Bing
 * from treating the factory as scaled junk — not a smaller advertised set.
 */
export const EMBEDDED_RAMP_LEVEL = 5 as 0 | 1 | 2 | 3 | 4 | 5;
