interface CommercialTerm {
  term: string;
  href: string;
}

const commercialTerms: CommercialTerm[] = [
  { term: 'AWS EventBridge', href: 'https://aws.amazon.com/eventbridge/' },
  { term: 'Amazon Web Services', href: 'https://aws.amazon.com/' },
  { term: 'GitHub Actions', href: 'https://github.com/features/actions' },
  { term: 'GitLab CI', href: 'https://about.gitlab.com/stages-devops-lifecycle/continuous-integration/' },
  { term: 'Cloud Scheduler', href: 'https://cloud.google.com/scheduler' },
  { term: 'DigitalOcean', href: 'https://www.digitalocean.com/' },
  { term: 'Cloudflare', href: 'https://www.cloudflare.com/' },
  { term: 'MongoDB', href: 'https://www.mongodb.com/' },
  { term: 'Postman', href: 'https://www.postman.com/' },
  { term: 'Insomnia', href: 'https://insomnia.rest/' },
  { term: 'GitHub', href: 'https://github.com/' },
  { term: 'Vercel', href: 'https://vercel.com/' },
  { term: 'Netlify', href: 'https://www.netlify.com/' },
  { term: 'AWS', href: 'https://aws.amazon.com/' },
];

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

  for (const entry of commercialTerms) {
    const placeholder = `__commercial_link_${placeholders.length}__`;
    const href = escapeHtml(entry.href);
    const anchor = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${entry.term}</a>`;
    const regex = new RegExp(`\\b${escapeRegExp(entry.term)}\\b`, 'g');
    processed = processed.replace(regex, placeholder);
    placeholders.push(anchor);
  }

  placeholders.forEach((anchor, index) => {
    processed = processed.replaceAll(`__commercial_link_${index}__`, anchor);
  });

  return processed;
}
