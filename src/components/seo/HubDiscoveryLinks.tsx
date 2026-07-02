import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { getOrRefreshHubLinks } from '@/lib/indexing/hubDiscovery';

interface HubDiscoveryLinksProps {
  hubPath: string;
  heading?: string;
}

export async function HubDiscoveryLinks({
  hubPath,
  heading = 'Related Technical Guides',
}: HubDiscoveryLinksProps) {
  const snapshot = await getOrRefreshHubLinks({
    hubPath,
    siteUrl: siteConfig.siteUrl,
    count: 6,
    refreshMinutes: 180,
  });

  if (!snapshot.links.length) return null;

  return (
    <section className="mt-12 rounded-2xl border bg-muted/20 p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Hand-picked guides and tools from the DevSolve product — written for engineers, not search engines.
      </p>
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {snapshot.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch={undefined}
              className="block rounded-lg border bg-background px-4 py-3 text-sm font-medium hover:border-primary/40 hover:text-primary"
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
