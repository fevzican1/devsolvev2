import { collectPrioritySlugs, countPrioritySlugs } from '@/data/programmatic';
import { resolveStaticProgrammaticPathLimit } from '@/config/staticGeneration';

const staticPathLimit = resolveStaticProgrammaticPathLimit(countPrioritySlugs());

/** Every /k route emitted by the static export. Never link or sitemap a route outside this set. */
export const staticProgrammaticSlugs = collectPrioritySlugs(staticPathLimit);

export const staticProgrammaticSlugSet = new Set(staticProgrammaticSlugs);
