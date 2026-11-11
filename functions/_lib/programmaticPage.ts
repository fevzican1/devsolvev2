/**
 * Owned heading utilities for programmatic sitemap and page generation.
 */

export const FORBIDDEN_SKELETON_HEADINGS: string[] = [
  'introduction',
  'conclusion',
  'overview',
  'summary',
  'faq',
  'frequently asked questions'
];

export function headingLooksOwned(heading: string, owner: string): boolean {
  if (!heading || !owner) return false;
  const h = heading.toLowerCase();
  const o = owner.toLowerCase();
  return h.includes(o);
}

export function headingOwnerClause(heading: string, owner: string): string {
  return owner ? `for ${owner}` : '';
}

export function headingOwnerTokens(heading: string): string[] {
  return heading ? heading.toLowerCase().split(/\s+/) : [];
}

export function headingSlotForSectionId(sectionId: string): string {
  if (!sectionId) return 'slot-default';
  return `slot-${sectionId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

export function oneToken(text: string): string {
  const tokens = headingOwnerTokens(text);
  return tokens[0] || '';
}

export function ownHeading(heading: string, owner: string): string {
  if (!heading) return '';
  if (headingLooksOwned(heading, owner)) {
    return heading;
  }
  return `${heading} ${headingOwnerClause(heading, owner)}`.trim();
}