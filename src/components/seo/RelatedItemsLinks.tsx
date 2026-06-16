import Link from 'next/link';

export interface RelatedItemLink {
  href: string;
  label: string;
  description?: string;
}

interface RelatedItemsLinksProps {
  title?: string;
  items: RelatedItemLink[];
}

export function RelatedItemsLinks({
  title = 'Related Pages',
  items,
}: RelatedItemsLinksProps) {
  const unique = new Map<string, RelatedItemLink>();

  for (const item of items) {
    if (!item.href || unique.has(item.href)) continue;
    unique.set(item.href, item);
    if (unique.size >= 10) break;
  }

  const links = Array.from(unique.values());
  if (links.length === 0) return null;

  return (
    <section className="mt-12 rounded-2xl border bg-muted/20 p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Explore related pages selected for this topic.
      </p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={item.href.startsWith('/k/') ? false : undefined}
              className="block rounded-lg border bg-background px-4 py-3 text-sm hover:border-primary/40 hover:text-primary"
            >
              <span className="block font-medium">{item.label}</span>
              {item.description && (
                <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
