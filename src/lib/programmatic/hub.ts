export const PROGRAMMATIC_HUB_LABEL_SEGMENTS = 8;
export const PROGRAMMATIC_HUB_ACRONYM_LENGTH = 3;

export function formatProgrammaticHubLabel(slug: string): string {
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
