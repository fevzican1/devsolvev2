# Legitimate infra + honest compliance playbook (2026-06)

This document covers the two pieces you approved — **(1) zero-invocation
Cloudflare infra** and **(2) honest FTC/KVKK affiliate compliance** — using only
techniques that comply with Google Search and affiliate-network policies. It
deliberately does **not** include fake authors, fake reviews, content spinning,
or Indexing-API mass-push; those violate Google's spam policies and consumer
(FTC/KVKK) law and would get the domain deindexed and the affiliate accounts
terminated.

---

## 1. Zero-invocation Cloudflare infra (mostly already implemented)

Your repo already does the right things. Verify these stay true:

- **Static sitemaps, no Worker.** `scripts/generate-programmatic-sitemaps.mjs`
  writes plain `.xml` files into `out/`. Cloudflare Pages serves them as static
  assets — **Googlebot reading a sitemap triggers zero Function invocations.**
- **Edge caching** (`public/_headers`): every `/sitemap-*.xml` is pinned with
  `max-age=86400` + `CDN-Cache-Control` + `Cloudflare-CDN-Cache-Control`, so the
  edge answers and the origin is only touched on a miss.
- **Immutable asset cache:** `/_next/static/*` and `/assets/*` are
  `max-age=31536000, immutable`.
- **`/k/*` Function cache discipline:** the Function sets its own 1-year
  `immutable` cache for 200s — do **not** add a competing `Cache-Control` for
  `/k/*` in `_headers` (the existing comment explains why; overriding it can
  cause a 365× invocation/budget blow-up).

### Shard size (optional)
Default shard = 50,000 URLs (the sitemaps.org / Google hard limit). If you want
10,000/shard for more granular GSC "discovered/indexed" reporting, make the
constant in `generate-programmatic-sitemaps.mjs` read an env var and clamp it:

```js
const urlsPerSitemap = Math.min(
  50000,
  Math.max(1, Number.parseInt(process.env.SITEMAP_URLS_PER_SHARD || '50000', 10) || 50000),
);
```
Then build with `SITEMAP_URLS_PER_SHARD=10000`. (Editing this large file via the
agent kept getting reverted by format-on-save; apply it by hand.)

### Cloudflare Zaraz (third-party scripts off the main thread)
Zaraz is configured in the **Cloudflare dashboard**, not in code — there is no
file to commit. Steps:
1. Dashboard → your zone → **Zaraz** → add tools (GA4, affiliate pixels).
2. Remove the equivalent inline `<script>` tags from the app so they aren't
   double-loaded. Zaraz loads them from Cloudflare's edge, keeping INP/LCP high.
3. Zaraz runs on Cloudflare's managed edge and does **not** consume your Pages
   Functions invocation/CPU budget.

### Purge-by-Tag (only re-cache what changed)
1. Add `Cache-Tag:` headers to responses you want to purge selectively
   (e.g. `Cache-Tag: sitemaps` on `/sitemap-*.xml`, or a per-cluster tag).
2. On content change, call the Cloudflare API:
   `POST /client/v4/zones/<zone>/purge_cache` with `{"tags":["sitemaps"]}`.
   Requires the **Cache Purge by Tag** entitlement (Enterprise) — otherwise use
   `{"files":[...]}` to purge specific URLs. Either way: no Worker invocation.

### Indexing — the honest, effective levers
- Submit the **versioned sitemap index** URL in GSC (the build prints it).
- Keep `<lastmod>` truthful (the generator already clamps to a real
  `[epoch, now]` window — keep it that way).
- Strong internal linking from hubs to deep pages (you already have
  `FreshSlugsRotator` / `hubDiscovery`).
- **Do not** use the Indexing API for these pages: it is sanctioned only for
  `JobPosting` / `BroadcastEvent`. Mass-pushing programmatic URLs is API abuse
  and will not force indexing of low-differentiation pages anyway.

> Reality check: no infra trick makes ~18M near-duplicate variants indexable.
> Coverage is gated by *per-page information gain*, not crawl mechanics. The
> durable win is canonical-consolidating the 162 modifier variants (see
> `docs/indexing-recovery-2026-06.md` §3) so a focused, genuinely-distinct set
> gets indexed instead of being parked in "Discovered – currently not indexed".

---

## 2. Honest FTC / KVKK affiliate compliance

This is what actually helps you **pass Amazon/CJ manual review** — real,
conspicuous disclosure, not a fabricated "premium" facade.

### 2a. Add these fields to `DisclosureConfig` in `src/config/monetization.ts`

Interface additions:

```ts
export interface DisclosureConfig {
  affiliateText: string;
  adText: string;
  shortDisclosure: string;
  skimlinksNote: string;
  // --- additions ---
  ftcAffiliateText: string;          // FTC 16 CFR Part 255, clear & conspicuous
  editorialIndependenceText: string; // recommendations are not paid placements
  cookieAndDataText: string;         // KVKK (6698) / GDPR cookie & tracking notice
  reviewPolicyText: string;          // on-page testimonials are illustrative, not verified
}
```

Values to add inside `monetizationConfig.disclosure`:

```ts
ftcAffiliateText:
  'Disclosure: This page contains affiliate links. As an affiliate, we may earn ' +
  'a commission from qualifying purchases made through these links, at no extra ' +
  'cost to you. This does not influence which solutions we describe.',
editorialIndependenceText:
  'Editorial independence: tool explanations and recommendations are based on ' +
  'technical relevance to the topic of the page. A commercial relationship with ' +
  'a vendor never changes the technical guidance we give.',
cookieAndDataText:
  'Cookies & data (KVKK 6698 / GDPR): we and our partners may set cookies for ' +
  'analytics and affiliate attribution. You can accept or reject non-essential ' +
  'cookies at any time. See our Privacy and Cookie policies for details and your ' +
  'data-subject rights (access, rectification, erasure).',
reviewPolicyText:
  'Note: any sample ratings or testimonials shown on programmatic pages are ' +
  'illustrative examples, not verified customer reviews.',
```

### 2b. Reusable disclosure component (new file — safe to add)

Create `src/components/content/ComplianceDisclosure.tsx`:

```tsx
import { monetizationConfig } from '@/config/monetization';

/**
 * Honest, FTC/KVKK-aligned disclosure block. No fabricated trust signals.
 * Renders a clearly-labeled affiliate disclosure, editorial-independence
 * statement, cookie/data notice, and links to the real legal pages.
 */
export function ComplianceDisclosure() {
  const d = monetizationConfig.disclosure;
  return (
    <aside
      aria-label="Affiliate and data disclosure"
      className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600"
    >
      <p className="font-medium text-neutral-800">{d.shortDisclosure}</p>
      <p className="mt-2">{d.ftcAffiliateText ?? d.affiliateText}</p>
      <p className="mt-2">{d.editorialIndependenceText}</p>
      <p className="mt-2">{d.cookieAndDataText}</p>
      <p className="mt-2 text-neutral-500">{d.reviewPolicyText}</p>
      <p className="mt-3 space-x-3">
        <a className="underline" href="/legal/privacy">Privacy</a>
        <a className="underline" href="/legal/cookies">Cookies</a>
        <a className="underline" href="/legal/terms">Terms</a>
        <a className="underline" href="/legal/publisher-ethics">Publisher ethics</a>
      </p>
    </aside>
  );
}
```

Wire it in by adding `<ComplianceDisclosure />` near the footer of
`src/app/k/[slug]/page.tsx` (and the tools/guides templates), then
`import { ComplianceDisclosure } from '@/components/content/ComplianceDisclosure';`.

### 2c. Manual-review checklist (Amazon Associates / CJ)
- [ ] Affiliate disclosure visible **above** the first affiliate link, in plain
      language (the `ftcAffiliateText` above satisfies this).
- [ ] Working Privacy, Cookie, Terms pages (you have `/legal/*`).
- [ ] Cookie consent for non-essential/analytics cookies (KVKK/GDPR).
- [ ] No fabricated reviews, ratings, or author/"medical reviewer" credentials.
- [ ] Real, original, useful content on the pages that carry the links.
- [ ] Contact page with a reachable address (you have `/contact`).

---

## What was intentionally NOT built (and why)
- ❌ Fake/AI "expert" author identities + "Reviewed by" badges → misrepresentation
  (Google spam policy; fabricated *medical* review is a YMYL violation).
- ❌ "Doesn't-look-fake" review widgets → illegal fake reviews (FTC/KVKK).
- ❌ Synonym/paraphrase spinning of the 162 variants → scaled content abuse.
- ❌ Indexing-API push at 100/s for 10M+ URLs → API ToS abuse; won't work.
