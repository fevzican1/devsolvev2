# AI Indexing Agent — cost-free crawler activation (2026-08-12)

## What “AI activates when Google/Bing crawl” means here

There is **no paid LLM** and **no extra Cloudflare Worker**. The AI Indexing Agent is a deterministic quality brain shared by:

| Layer | Role | Cost |
|-------|------|------|
| `scripts/lib/ai-indexing-agent.mjs` | Policy / contract / cost model | Build CPU only |
| `scripts/lib/search-guidelines.mjs` | Bing §1–22 + Google indexing reasons as rules | Build CPU only |
| `scripts/lib/ai-quality-scoring.mjs` | 0–100 score + guideline audit | Build CPU only |
| `functions/_lib/programmaticPage.ts` | Renders guideline-compliant HTML for all 20M `/k/` URLs | Function **only on cache miss** |
| `functions/[[path]].ts` | Serves + caches; **same bytes for every User-Agent** | Zone HIT = $0 |

Flow:

```
Bingbot/Googlebot → WAF skip → CDN HIT  → HTML (Function never runs)
Bingbot/Googlebot → WAF skip → CDN MISS → Function renders once → cache 30d → later HITs free
```

Cloaking (different HTML for crawlers vs users) is **forbidden** and would violate Bing abuse guidelines.

## PR134 / PR135 invariants preserved

- Title **30–69** (Bing: strictly &lt; 70)
- Meta description **150–160**, unique across 20M
- Edge sitemap stays on **ramp** (level 0 = 500k), not full 20M
- Guides/hubs link **only** static ≤5k `/k/` slugs
- No new Workers; Function still only `/k/*` + sitemaps

## What this upgrade adds (v2026-08-12.2)

1. Explicit **entity definition** block (Bing §16) near the top of every page  
2. **Decision guide** — when this exact style×context URL applies vs siblings (Bing §11/§17)  
3. **Acceptance criteria** a reviewer can verify independently (Bing §15)  
4. New guideline checks: `entity-definition`, `early-answer`, `single-topic`, `decision-guide`  
5. `CONTENT_VERSION` bump so colo cache keys orphan old HTML without a mass purge  

## Honest limit (unchanged)

All 20M URLs are **technically indexable**. Engines will not index 20M near-combinatorial URLs at once — keep the sitemap ramp and let GSC gates advance 500k → 2M → … → 20M.
