import { REVENUE_HOPS, REVENUE_REL } from '@/config/revenue';

const OFFERS = [
  { hop: REVENUE_HOPS.vultr, name: 'Vultr', credit: '$100 free cloud credit' },
  { hop: REVENUE_HOPS.digitalocean, name: 'DigitalOcean', credit: '$200 new-account credit' },
  { hop: REVENUE_HOPS.scraperapi, name: 'ScraperAPI', credit: 'free trial credits' },
] as const;

interface ContextProps {
  toolName?: string;
  job?: string;
  seed?: string;
}

function featuredIndex(seed?: string): number {
  if (!seed) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % OFFERS.length;
}

/** Reserved header isolation slot — no third-party script. */
export function AdHeaderSlot() {
  return (
    <div
      id="ad-header-slot"
      style={{ minHeight: 90, margin: '10px 0' }}
      aria-hidden="true"
    />
  );
}

/** Sticky footer isolation slot — pointer-events none while empty so it cannot steal clicks. */
export function AdFooterSlot() {
  return (
    <div
      id="ad-footer-slot"
      style={{
        minHeight: 50,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}

export function B2BDatasetCard({ toolName, job }: ContextProps) {
  const subject = [toolName, job].filter(Boolean).join(' ');
  const detail = subject
    ? `Download the technical configuration for this ${subject} workflow as raw JSON.`
    : 'Download this page’s technical configuration as raw JSON.';

  return (
    <aside
      className="b2b-dataset-card"
      style={{
        background: '#0f172a',
        color: '#fff',
        border: '1px solid #334155',
        padding: 20,
        borderRadius: 8,
        margin: '30px 0',
      }}
    >
      <span
        style={{
          background: '#38bdf8',
          color: '#0f172a',
          fontSize: 10,
          fontWeight: 'bold',
          padding: '2px 8px',
          borderRadius: 4,
        }}
      >
        B2B ACCESS
      </span>
      <h4 style={{ margin: '10px 0 5px 0', color: '#fff', fontSize: 16 }}>
        Raw JSON dataset and API access
      </h4>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 15 }}>
        {detail} Paid via Payoneer — one click, no account on this site.
      </p>
      <a
        href={REVENUE_HOPS.buyDataset}
        target="_blank"
        rel={REVENUE_REL.ownProduct}
        style={{
          background: '#22c55e',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 6,
          fontWeight: 'bold',
          textDecoration: 'none',
          display: 'inline-block',
          fontSize: 13,
        }}
      >
        Download dataset ($25) →
      </a>
      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        Own product. Internal hop; destination can change without republishing this page.
      </p>
    </aside>
  );
}

export function NativeInfrastructureCard({ toolName, job, seed }: ContextProps) {
  const featured = OFFERS[featuredIndex(seed)];
  const lead = toolName
    ? `To run this ${toolName}${job ? ` ${job}` : ''} check in production, claim startup cloud credit.`
    : 'Claim startup cloud credit to run this workflow in production.';

  return (
    <aside
      className="native-affiliate-box"
      style={{
        background: '#f8fafc',
        borderLeft: '4px solid #2563eb',
        padding: 15,
        margin: '20px 0',
      }}
    >
      <strong style={{ color: '#1e293b', fontSize: 14 }}>
        Recommended developer infrastructure
      </strong>
      <p style={{ color: '#475569', fontSize: 12, margin: '5px 0 10px 0' }}>
        {lead} Featured here: {featured.name}.
      </p>
      <div>
        {OFFERS.map((offer) => (
          <a
            key={offer.hop}
            href={offer.hop}
            target="_blank"
            rel={REVENUE_REL.sponsored}
            style={{
              color: '#2563eb',
              fontWeight: offer.hop === featured.hop ? 700 : 600,
              fontSize: 13,
              textDecoration: 'underline',
              marginRight: 14,
              display: 'inline-block',
              marginBottom: 6,
            }}
          >
            {offer.name} — {offer.credit} →
          </a>
        ))}
      </div>
      <p style={{ color: '#64748b', fontSize: 11, margin: '10px 0 0' }}>
        Sponsored. We may earn a commission at no extra cost to you. rel=&quot;nofollow sponsored&quot;.
      </p>
    </aside>
  );
}

/** Content-footer stack: B2B Payoneer product + native hosting/devtools hops. */
export function StaticRevenueModules({ toolName, job, seed }: ContextProps) {
  return (
    <>
      <B2BDatasetCard toolName={toolName} job={job} />
      <NativeInfrastructureCard toolName={toolName} job={job} seed={seed} />
    </>
  );
}
