/**
 * FreshSlugsRotator
 *
 * Surfaces a deterministic set of exported /k/* URLs on hub pages. Links are
 * restricted to build output so crawlers never reach a route that needs a
 * runtime function.
 *
 * ZERO RUNTIME COST
 * -----------------
 * This is a SERVER COMPONENT. The rotation is computed once at build time
 * (when Next.js statically generates /tools and /guides). The resulting
 * HTML is pure static markup served from the Cloudflare CDN. No request
 * ever invokes a Cloudflare Function for this block.
 *
 * Determinism: the hub salt is hashed with the slot index to pick from the
 * static programmatic path set.
 */

import Link from 'next/link';
import { staticProgrammaticSlugs } from '@/lib/programmatic/staticPaths';

// Tokens that should render as upper-case acronyms rather than Title Case so
// the labels read like real engineering guide titles ("JSON", not "Json").
const ACRONYMS: Record<string, string> = {
  json: 'JSON', jwt: 'JWT', api: 'API', url: 'URL', html: 'HTML',
  uuid: 'UUID', css: 'CSS', sql: 'SQL', qa: 'QA', sre: 'SRE',
};

function prettifyToken(token: string): string {
  const lower = token.toLowerCase();
  if (ACRONYMS[lower]) return ACRONYMS[lower];
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function prettifyPhrase(phrase: string): string {
  return phrase.split('-').filter(Boolean).map(prettifyToken).join(' ');
}

function pickFreshSlugs(seedSalt: string, count: number): Array<{ slug: string; label: string }> {
  const out: Array<{ slug: string; label: string }> = [];
  const seen = new Set<string>();

  // Search a wider window than `count` so that, after de-duplicating by the
  // VISIBLE label, we can still fill every slot with a distinct title.
  for (let slot = 0; slot < count * 12 && out.length < count; slot += 1) {
    // 32-bit hash combining the hub salt + slot for deterministic output.
    let h = 5381;
    const key = `${seedSalt}-${slot}`;
    for (let i = 0; i < key.length; i += 1) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
    const slug = staticProgrammaticSlugs[Math.abs(h) % staticProgrammaticSlugs.length];
    if (!slug) continue;
    const label = prettifyPhrase(slug.replace(/-\d+$/, ''));
    // De-duplicate on the rendered label (not the raw slug). Two slugs that
    // differ only by their numeric modifier suffix used to render identical
    // text — that repetition is exactly what read as spam on the homepage.
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ slug, label });
  }
  return out;

}

interface FreshSlugsRotatorProps {
  /** Unique salt so the same hub doesn't pick identical slugs as another. */
  salt: string;
  /** Title shown above the block. */
  heading?: string;
  /** Short blurb under the title. */
  description?: string;
  /** How many fresh links to render (default 12). */
  count?: number;
}

export function FreshSlugsRotator({
  salt,
  heading = 'Fresh from the Workshop',
  description = 'A rotating selection of newly highlighted deep-dive guides. Updated with each deployment.',
  count = 12,
}: FreshSlugsRotatorProps) {
  const items = pickFreshSlugs(salt, count);
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Fresh content rotation"
      className="mt-10 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <span aria-hidden="true">✨</span>
        <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>
      </div>
      <p className="mb-4 text-sm text-slate-600">{description}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/k/${item.slug}`}
              prefetch={false}
              className="block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default FreshSlugsRotator;
