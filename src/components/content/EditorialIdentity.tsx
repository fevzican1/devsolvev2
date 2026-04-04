import { commercialPlatforms } from '@/config/monetization';

interface EditorialIntroProps {
  toolName: string;
}

export const editorialTeamName = 'DevSolve Editorial Team';

function formatEditorialDate(): string {
  const date = new Date();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function EditorialByline() {
  const currentDate = formatEditorialDate();
  return (
    <div className="mb-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">By {editorialTeamName}</span>
        <span className="mx-2">-</span>
        <time dateTime={new Date().toISOString().split('T')[0]}>
          Last updated: {currentDate}
        </time>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Independently researched and written. All technical claims are verified against official documentation.
      </p>
    </div>
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
      <p className="text-xs text-muted-foreground mt-2">
        This content is created by the DevSolve editorial team and is not sponsored or influenced by any third party.
        All processing examples run locally in your browser.
      </p>
    </div>
  );
}

export function TransparencyBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      Verified original content
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
            rel="nofollow noopener noreferrer"
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
