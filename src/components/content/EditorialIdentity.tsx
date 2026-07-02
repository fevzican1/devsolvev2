import { commercialPlatforms, isMonetizationConfigured } from '@/config/monetization';

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
        Written for working engineers. Technical claims are checked against official documentation where applicable.
      </p>
    </div>
  );
}

export function EditorialIntro({ toolName }: EditorialIntroProps) {
  return (
    <div className="mb-6 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm leading-7 text-foreground/90">
        {toolName} is covered here as an editorial guide: what the tool does, where it
        fits in real engineering workflows, and how to get the most out of it for
        day-to-day development tasks.
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        This content is maintained by the DevSolve editorial team and is not sponsored or influenced by any third party.
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
      Editorially reviewed
    </div>
  );
}

export function CommercialOpportunityLinks() {
  if (!isMonetizationConfigured()) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground leading-7 mb-6">
      Related vendor documentation frequently referenced alongside this topic:{' '}
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
      . These are neutral reference links — not sponsored placements unless explicitly labeled elsewhere.
    </p>
  );
}

export function OriginalValueCallouts({ toolName }: EditorialIntroProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mt-8">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Expert Tip</p>
        <p className="text-sm text-muted-foreground">
          Run {toolName} on realistic staging samples before merging changes — compare output structure,
          edge-case behavior, and performance on payloads similar to production.
        </p>
      </div>
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Implementation Warning</p>
        <p className="text-sm text-muted-foreground">
          Do not treat browser-tool output as a substitute for your service&apos;s validation rules.
          Always enforce constraints in your application or pipeline before release.
        </p>
      </div>
    </div>
  );
}
