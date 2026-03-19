interface EditorialIntroProps {
  toolName: string;
}

const commercialPlatforms = [
  { name: 'Cloudflare', href: 'https://www.cloudflare.com/' },
  { name: 'AWS', href: 'https://aws.amazon.com/' },
  { name: 'DigitalOcean', href: 'https://www.digitalocean.com/' },
  { name: 'MongoDB', href: 'https://www.mongodb.com/' },
  { name: 'GitHub', href: 'https://github.com/' },
];

export const editorialTeamName = 'Devsolveco Editorial Team';
export const editorialLastUpdated = 'March 19, 2026';

export function EditorialByline() {
  return (
    <p className="text-sm text-muted-foreground mb-3">
      <span className="font-medium text-foreground">By {editorialTeamName}</span>
      <span className="mx-2">-</span>
      <span>Last updated: {editorialLastUpdated}</span>
    </p>
  );
}

export function EditorialIntro({ toolName }: EditorialIntroProps) {
  return (
    <div className="mb-6 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm leading-7 text-foreground/90">
        {toolName} is covered here as an editorial buying guide: what the tool does, where it
        fits in real engineering workflows, and when a paid plan is worth purchasing for better
        scale, reliability, and team collaboration.
      </p>
    </div>
  );
}

export function CommercialOpportunityLinks() {
  return (
    <p className="text-sm text-muted-foreground leading-7 mb-6">
      Commercial options frequently evaluated in this stack include{' '}
      {commercialPlatforms.map((platform, index) => (
        <span key={platform.name}>
          <a
            href={platform.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {platform.name}
          </a>
          {index < commercialPlatforms.length - 2 && ', '}
          {index === commercialPlatforms.length - 2 && ' and '}
        </span>
      ))}
      . Use the official vendor pages above when comparing pricing, SLAs, and enterprise features.
    </p>
  );
}

export function OriginalValueCallouts({ toolName }: EditorialIntroProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mt-8">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Expert Tip</p>
        <p className="text-sm text-muted-foreground">
          Run {toolName} on production-like samples before purchase decisions, then compare output
          quality, speed, and auditability across vendor plans.
        </p>
      </div>
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Implementation Warning</p>
        <p className="text-sm text-muted-foreground">
          Do not finalize procurement using only feature lists; validate security controls,
          integration limits, and data handling constraints in a proof-of-concept first.
        </p>
      </div>
    </div>
  );
}
