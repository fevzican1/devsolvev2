export const PROGRAMMATIC_HUB_LABEL_SEGMENTS = 8;
export const PROGRAMMATIC_HUB_ACRONYM_LENGTH = 3;
export const PROGRAMMATIC_HUB_FALLBACK_LABEL = 'Unknown Programmatic Page';

export function formatProgrammaticHubLabel(slug: string): string {
  if (!slug.trim()) {
    return PROGRAMMATIC_HUB_FALLBACK_LABEL;
  }

  return slug
    .replace(/-\d+$/, '')
    .split('-')
    .slice(0, PROGRAMMATIC_HUB_LABEL_SEGMENTS)
    .map((segment) => (
      segment.length <= PROGRAMMATIC_HUB_ACRONYM_LENGTH
        ? segment.toUpperCase()
        : segment.charAt(0).toUpperCase() + segment.slice(1)
    ))
    .join(' ');
}

export function getProgrammaticHubSampleStep(total: number, count: number): number {
  const normalizedCount = count > 0 ? count : 1;
  return Math.max(1, Math.floor(total / normalizedCount));
}
