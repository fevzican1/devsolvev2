/**
 * Priority cluster ordering for link sculpting.
 *
 * The 10 backlink "authority" enters the site through the homepage (Level 0).
 * To avoid diluting page-authority across 20M pages at once, internal link
 * blocks on the homepage and category pages surface HIGH-VALUE clusters first,
 * steering Googlebot toward the most crawl-worthy /k/ and guide URLs before
 * lower-priority slices.
 *
 * Order reflects organic-search demand + programmatic coverage:
 *   json, encoding, security → core developer tools (highest intent)
 *   api, data                 → integration / payload workflows
 *   formatting, text          → daily-editorial tasks
 *   debugging, automation, web → longer-tail operational slices
 */
export const PRIORITY_CLUSTER_ORDER: readonly string[] = [
  'json',
  'encoding',
  'security',
  'api',
  'data',
  'formatting',
  'text',
  'debugging',
  'automation',
  'web',
] as const;

/**
 * Sort cluster keys so priority clusters appear first. Non-listed clusters
 * fall to the end in their original relative order.
 */
export function sortClustersByPriority(clusters: readonly string[]): string[] {
  const priorityIndex = new Map(
    PRIORITY_CLUSTER_ORDER.map((key, i) => [key, i]),
  );
  return [...clusters].sort((a, b) => {
    const ai = priorityIndex.get(a) ?? PRIORITY_CLUSTER_ORDER.length;
    const bi = priorityIndex.get(b) ?? PRIORITY_CLUSTER_ORDER.length;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}
