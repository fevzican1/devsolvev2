import { commercialTermLinks } from '@/config/monetization';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function linkifyCommercialTerms(text: string): string {
  if (!text) return '';

  let processed = escapeHtml(text);
  const placeholders: string[] = [];

  for (const entry of commercialTermLinks) {
    const placeholder = `__commercial_link_${placeholders.length}__`;
    const href = escapeHtml(entry.href);
    const anchor = `<a href="${href}" target="_blank" rel="nofollow noopener noreferrer" class="text-primary hover:underline">${entry.term}</a>`;
    const regex = new RegExp(`\\b${escapeRegExp(entry.term)}\\b`, 'g');
    processed = processed.replace(regex, placeholder);
    placeholders.push(anchor);
  }

  placeholders.forEach((anchor, index) => {
    processed = processed.replaceAll(`__commercial_link_${index}__`, anchor);
  });

  return processed;
}
