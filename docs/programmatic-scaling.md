## Programmatic scaling playbook (DevSolve)

This document describes how to scale the `/k/[slug]` programmatic pages in a controlled way while protecting crawl budget, index safety and useful-content-first principles.

The goal is to support a 10K-page architecture without forcing all pages live at once.

---

### 1. What `safeDefaultTotal` does

- `safeDefaultTotal` in `siteConfig.programmatic` is the conservative default number of programmatic pages exported when no explicit ramp level is set.
- It is intentionally lower than the architecture target to:
  - keep Netlify builds fast and predictable,
  - keep the first waves of URLs easy to monitor,
  - avoid flooding sitemaps with pages that have not been evaluated yet.

Operationally:
- If `opsFlags.programmaticRampLevel` is unset or `0`, the generator uses `safeDefaultTotal`.
- Use this as the default mode for first deployments of a new cluster or major generator change.

---

### 2. How `programmaticRampLevel` is increased

- `programmaticRampLevel` lives in `monetizationConfig.opsFlags`.
- Allowed values: `0 | 1 | 2 | 3 | 4 | 5`.
- Each level maps to an entry in `siteConfig.programmatic.rampSchedule`:
  - `0` → `safeDefaultTotal`
  - `1..5` → progressively larger targets up to the full 10K architecture.

Ramp discipline:
- Increase the level manually and incrementally only after:
  - running a fresh build and postbuild on a branch or preview,
  - reviewing the quality and crawl reports,
  - checking that disclosure and monetization footprint look balanced.
- Avoid skipping levels; this helps catch issues early and keeps changes observable.

---

### 3. Which reports to review before a Netlify deploy

After `npm run build` completes, inspect the artifacts under `out/reports/`:

- `quality.json`:
  - check:
    - `totalGenerated`
    - `indexableCount`
    - `sitemapIncludedCount`
    - `noindexCount`
    - `segmentCounts` (A/B/C)
    - `clusterDistribution`
    - `excludedBySitemapThreshold`
    - `excludedByIndexThreshold`
  - confirm that:
    - Segment A (index + sitemap) is a conservative subset,
    - Segment C (noindex,follow) exists for weaker pages,
    - no single cluster dominates the sample unless intentionally configured.

- `quality.txt`:
  - skim example slugs and scores,
  - look for repeated warnings like `long-slug` or `below-index-threshold`.

If the report shows rising C segment share, low usefulness warnings, or skewed cluster distribution, pause ramp-up until the underlying content or generator is improved.

---

### 4. When to increase sitemap coverage

Consider expanding sitemap coverage (via ramp level) only when:

- current Segment A pages:
  - are helpful on their own,
  - have clear intros, steps, pitfalls and comparison blocks,
  - feel like real guides rather than near-duplicate keyword variants.
- the ratio:
  - `sitemapIncludedCount / indexableCount` is stable or improving,
  - `noindexCount` is not growing faster than indexable pages.

Avoid adding large new batches of URLs to sitemaps when:

- quality scores cluster near the minimum sitemap threshold,
- there are many similarity or usefulness warnings,
- disclosure or monetization modules have just been changed and not yet observed in production.

---

### 5. When to pause or reverse a ramp increase

Pause ramp increases (or temporarily reduce the level) if:

- `noindexCount` climbs faster than `indexableCount`,
- `sitemapIncludedCount` stagnates while total generated pages grow,
- `lowUsefulnessWarnings` trend upward in `quality.json`,
- the commercial footprint of pages feels heavier than the underlying content.

Operationally:

- lowering `programmaticRampLevel` reduces the active exported set in the next build,
- sitemap chunks will automatically reflect the smaller set because only higher scoring pages are written into the programmatic sitemap files.

---

### 6. Balancing Skimlinks-style monetization visibility

The monetization layer is designed to be compatible with networks such as Skimlinks without turning pages into affiliate-first experiences.

Keep the following discipline:

- Affiliate or monetized links should:
  - appear in sections that are already useful without the link,
  - be relevant to the specific tool, guide, or cluster,
  - be limited in number per page.
- For tool-first pages:
  - keep the interactive tool and its explanation clearly above any recommendation modules.
- For guide-first pages:
  - let the walkthrough, context, and limitations come first,
  - then surface recommendations and alternatives.
- For programmatic `/k/[slug]` pages:
  - treat monetization as optional and supportive,
  - avoid repeating the same call to action pattern across large families of near-identical slugs.

If monetization elements ever feel louder than the content itself, treat that as a signal to simplify or move them further down the page.

---

### 7. How index / noindex works for programmatic pages

- Each programmatic page is evaluated with a quality score based on:
  - uniqueness and variety,
  - usefulness (steps, pitfalls, comparison),
  - depth (intro and description),
  - relevance (cluster + primary tool),
  - basic footprint checks (slug and keyword discipline).

Segments:

- **Segment A**
  - score ≥ sitemap threshold,
  - can be indexed,
  - eligible for sitemap inclusion.
- **Segment B**
  - score between index and sitemap thresholds,
  - indexable but kept out of sitemaps,
  - used to avoid over-filling discovery with borderline pages.
- **Segment C**
  - score below the conservative index threshold,
  - exported but marked `noindex,follow`,
  - useful for users who discover the URL but not proactively promoted.

The aim is to keep sitemap entries concentrated on the most helpful programmatic pages while still serving other URLs if they are visited directly.

---

### 8. When to dial back monetization intensity

Reduce monetization visibility on a set of pages if:

- the same merchant or offer appears in many unrelated contexts,
- there are multiple monetization modules before the reader has seen any substantial content,
- disclosures become easy to miss or visually overshadowed,
- the quality report suggests high commercial footprint with relatively modest helpfulness.

Practical adjustments:

- lower the maximum number of offers per placement,
- narrow offer rules so that only tightly relevant clusters receive suggestions,
- move recommendation modules further down on programmatic pages.

---

### 9. What to do when similarity or orphan warnings appear

If future reporting introduces explicit similarity or orphan signals, use them as routing inputs rather than hard errors:

- For high similarity within a cluster:
  - consider reducing the ramp level,
  - tighten the generator so that each slug has a clearer angle (intent, audience, or task),
  - keep lower-value variants out of sitemaps or in Segment C.

- For orphan candidates:
  - ensure that tools, guides, and `/k/` pages link to each other using deterministic but natural anchors,
  - rebalance internal links so that no single hub page monopolises outbound links.

In all cases, prioritize improving the usefulness and clarity of the content before adding new slugs or monetization elements.

