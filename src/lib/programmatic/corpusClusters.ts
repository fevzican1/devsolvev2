/** Must match functions/_lib/programmaticPage.ts CLUSTERS first column. */
export const CORPUS_CLUSTER_KEYS = [
  'json',
  'encoding',
  'security',
  'text',
  'formatting',
  'api',
  'data',
  'debugging',
  'automation',
  'web',
] as const;

export function clusterHubHref(cluster: string): string {
  return `/g/${cluster}`;
}
