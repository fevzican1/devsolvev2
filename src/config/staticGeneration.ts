/**
 * Static generation & edge-ISR configuration.
 *
 * Programmatic /k/* pages are pre-rendered to Cloudflare R2 by
 * `scripts/ssg-r2-upload.mjs` and served via `workers/k-r2-router`.
 * See docs/r2-ssg-pipeline.md.
 *
 * Next.js still pre-renders up to MAX_STATIC_PROGRAMMATIC_PATHS priority pages
 * into out/k/ during build (belt-and-suspenders for the hub-adjacent tier).
 */
export const EDGE_ISR_REVALIDATE_SECONDS = 2_592_000;

/** Default number of priority /k/* pages to pre-render at build time. */
export const DEFAULT_STATIC_PROGRAMMATIC_PATHS = 5000;

/** Hard cap — Cloudflare Pages deployments have a per-deploy file count budget. */
export const MAX_STATIC_PROGRAMMATIC_PATHS = 5000;

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Resolve how many priority programmatic pages to export during `next build`. */
export function resolveStaticProgrammaticPathLimit(totalPrioritySlugs?: number): number {
  const envLimit = parsePositiveInt(
    process.env.PROGRAMMATIC_STATIC_BUILD_LIMIT ??
    process.env.NEXT_PUBLIC_PROGRAMMATIC_STATIC_BUILD_LIMIT,
  );

  const cap = envLimit ?? DEFAULT_STATIC_PROGRAMMATIC_PATHS;
  const clamped = Math.min(Math.max(1, cap), MAX_STATIC_PROGRAMMATIC_PATHS);

  if (typeof totalPrioritySlugs === 'number' && totalPrioritySlugs > 0) {
    return Math.min(clamped, totalPrioritySlugs);
  }

  return clamped;
}
