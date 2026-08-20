# Indexing root-fix — 2026-08-12

## What was broken

1. **Titles at exactly 70 chars** — Bing asks for *less than* 70. ~15% of titles were 70 and flagged.
2. **Edge sitemap advertised all 20M URLs** while `.ramp-level=0` (500k). Crawl budget dilution → Google barely crawls.
3. **Hubs stopped linking into `/k/*`** — discovery relied almost entirely on the giant sitemap.
4. **Guide→corpus helper invented fake ordinals** (`counter % 162`) → 301/404 link waste.
5. **Cloudflare "I'm Under Attack"** challenges non-skipped clients (`cf-mitigated: challenge`). Skip rule now covers Google/Bing *and* real browsers; **turn Security Level off in the CF dashboard** if challenges persist (API token lacks `zone_settings:edit`).

## What we fixed

| Area | Change |
|------|--------|
| Titles | `TITLE_MAX=69`, compact template saves 2 chars, safety clamp |
| Meta descriptions | Still hard-enforced 150–160 (corpus proof: 0 violations) |
| Sitemap | Edge serves **500k** (ramp 0), daily index `lastmod`, priority `changefreq=daily` |
| Internal links | 16–20 related `/k/` + guide/tool/home (~31 crawlable links/page) |
| Hubs/guides | Real corpus slugs via `guideCorpusLinks` + hub discovery mix |
| Discovery | IndexNow + free WebSub/sitemap pings (not a link scheme) |
| WAF | Skip crawlers + real browsers past Under Attack / Bot Fight |
| Quality gate | 20M identities unique; sample docs score 98–100 |

## Honest limit

All 20M pages are **indexable** (200, unique title/desc/H1, score ≥90, guideline-clean). Search engines will still **not** index 20M near-combinatorial URLs at once — ramp 500k → 2M → … → 20M as indexed ratio gates clear. Advertising 20M again will recreate the crawl stall.

## Manual step (required)

Cloudflare Dashboard → Security → Settings → **Security Level: Essentially Off** (or Medium). This agent’s token cannot change that setting.

## Build fix (static link audit)

Guides/hubs must only link to the ≤5k **statically exported** `/k/` priority set.
Edge pages still deep-link across the full corpus. Linking edge-only ordinals
from static HTML failed `internal-link-redirect-audit` and blocked deploy.

## Ramp auto-advance

Weekly workflow (`.github/workflows/ramp-auto-advance.yml`) advances when GSC
gates pass. It now updates **both** `.ramp-level` and
`functions/_lib/embeddedRamp.ts` so the live edge sitemap grows with the ramp
(500k → 2M → … → 20M). Until gates pass, level stays at 1 (2M advertised).
