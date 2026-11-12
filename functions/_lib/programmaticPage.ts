/**
 * Owned heading utilities for programmatic sitemap and page generation.
 */

export const EMBEDDED_RAMP_LEVEL = 5 as const;

export const FORBIDDEN_SKELETON_HEADINGS: readonly string[] = [
  'introduction',
  'conclusion',
  'overview',
  'summary',
  'faq',
  'frequently asked questions'
] as const;

export function headingLooksOwned(heading: string | null | undefined, owner: string | null | undefined): boolean {
  if (!heading || !owner) return false;
  const h = heading.toLowerCase();
  const o = owner.toLowerCase();
  return h.includes(o);
}

export function headingOwnerClause(heading: string | null | undefined, owner: string | null | undefined): string {
  return owner ? `for ${owner}` : '';
}

export function headingOwnerTokens(heading: string | null | undefined): string[] {
  return heading ? heading.toLowerCase().trim().split(/\s+/) : [];
}

export function headingSlotForSectionId(sectionId: string | null | undefined): string {
  if (!sectionId) return 'slot-default';
  return `slot-${sectionId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

export function oneToken(text: string | null | undefined): string {
  const tokens = headingOwnerTokens(text);
  return tokens[0] || '';
}

export function ownHeading(heading: string | null | undefined, owner: string | null | undefined): string {
  if (!heading) return '';
  if (headingLooksOwned(heading, owner)) {
    return heading;
  }
  return `${heading} ${headingOwnerClause(heading, owner)}`.trim();
}