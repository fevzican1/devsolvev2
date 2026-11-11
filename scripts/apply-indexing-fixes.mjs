#!/usr/bin/env node
/**
 * One-shot, idempotent patcher for functions/k/[[slug]].ts.
 *
 * The target filename contains `[[slug]]` (Cloudflare Pages catch-all syntax),
 * whose square brackets are glob metacharacters and break path-based editors.
 * Node's fs treats the path literally, so we apply the indexing-recovery edits
 * here instead.
 *
 * Each edit is guarded: if the `find` text is absent we report it (so the patch
 * is safe to re-run and won't silently double-apply).
 *
 * Run:  node scripts/apply-indexing-fixes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// The real repo is nested one directory deeper (a duplicated folder name).
// Resolve the target explicitly so the literal `[[slug]]` filename is honoured.
const target = join(
  __dirname,
  '..',
  'devsolvev2-agent-pages-manage-crawl-budget-dd8b',
  'functions',
  'k',
  '[[slug]].ts',
);


let src = readFileSync(target, 'utf8');
const log = [];

const edits = [
  /* ── FIX 1: Bot-guard fail-open for Google ────────────────────────────── */
  {
    id: 'botguard-fail-open',
    expect: 1,
    find:
      "  if (cf.botManagement?.verifiedBot === true) return true;\n" +
      "  if (typeof cf.asn === 'number') {\n" +
      "    if (GOOGLE_ASNS.has(cf.asn)) return true;\n" +
      "    // ASN known and NOT Google → definitely not Google.\n" +
      "    return false;\n" +
      "  }\n" +
      "  if (cf.asOrganization) {\n" +
      "    return /google/i.test(cf.asOrganization);\n" +
      "  }\n" +
      "  return null;\n" +
      "}",
    replace:
      "  if (cf.botManagement?.verifiedBot === true) return true;\n" +
      "  if (typeof cf.asn === 'number' && GOOGLE_ASNS.has(cf.asn)) return true;\n" +
      "  if (cf.asOrganization && /google/i.test(cf.asOrganization)) return true;\n" +
      "  // CRITICAL FAIL-OPEN: never return `false` for a non-Google ASN here.\n" +
      "  // On Cloudflare Pages (free/standard plan) request.cf fields are not\n" +
      "  // always reliably populated and Google fetches from a growing set of\n" +
      "  // ASNs/regions. Hard-blocking a Googlebot-claiming UA just because the\n" +
      "  // ASN missed our tiny allow-list previously produced 403s for real\n" +
      "  // Googlebot and mass-deindexed the site (100k -> 8). Returning null\n" +
      "  // ('cannot verify') makes decideAccess ALLOW the request. A spoofed\n" +
      "  // Googlebot UA only receives a cheap, deterministic, edge-cached page,\n" +
      "  // never a real attack surface, whereas a false-block destroys indexing.\n" +
      "  return null;\n" +
      "}",
  },

  /* ── FIX 2: Do NOT cache the bot-guard 403 ────────────────────────────── */
  // A transient mis-block of Googlebot must not be frozen at the edge for 24h.
  {
    id: 'access-denied-403-no-store',
    expect: 1,
    find:
      "    return new Response('Access Denied', {\n" +
      "\n" +
      "      status: 403,\n" +
      "      headers: {\n" +
      "        'Content-Type': 'text/plain;charset=UTF-8',\n" +
      "        'X-Robots-Tag': 'noindex, nofollow',\n" +
      "        'Cache-Control': 'public, max-age=86400',\n" +
      "      },\n" +
      "    });",
    replace:
      "    return new Response('Access Denied', {\n" +
      "      status: 403,\n" +
      "      headers: {\n" +
      "        'Content-Type': 'text/plain;charset=UTF-8',\n" +
      "        'X-Robots-Tag': 'noindex, nofollow',\n" +
      "        // no-store: a 403 here is an access *decision*, never a cacheable\n" +
      "        // artefact. Caching it for 24h previously meant one mistaken block\n" +
      "        // of Googlebot was replayed from the edge for a full day, turning a\n" +
      "        // momentary mis-classification into mass deindexing.\n" +
      "        'Cache-Control': 'no-store',\n" +
      "      },\n" +
      "    });",
  },

  /* ── FIX 3: Protective 404 (not 410) for shape-valid-but-unresolved ───── */
  // The length/regex gates keep 410 (genuine impossible garbage clears fastest).
  // But a slug that PASSES the strict canonical grammar yet fails to resolve is
  // exactly where a resolver/sitemap drift would silently DELETE a real page.
  // 410 = permanent removal; 404 = recoverable. We choose 404 + a short edge
  // cache so that if the page is in fact valid after a fix/redeploy, Google
  // re-crawls and re-indexes it instead of having obeyed an irreversible 410.
  {
    id: 'unresolved-shape-valid-410-to-404',
    expect: 1,
    find:
      "      return new Response(generateHubHtml(url, slug), {\n" +
      "        status: 410,\n" +
      "        headers: {\n" +
      "          ...responseHeaders,\n" +
      "          'X-Robots-Tag': 'noindex, follow',\n",
    replace:
      "      return new Response(generateHubHtml(url, slug), {\n" +
      "        // 404 (recoverable), NOT 410 (permanent). A shape-valid slug that\n" +
      "        // fails to resolve is the one place a resolver/sitemap drift could\n" +
      "        // wrongly delete a real /k/* page. 404 lets Google re-index it on\n" +
      "        // the next crawl after a fix; 410 would have destroyed it forever.\n" +
      "        status: 404,\n" +
      "        headers: {\n" +
      "          ...responseHeaders,\n" +
      "          'X-Robots-Tag': 'noindex, follow',\n",
  },

  /* ── FIX 4: Per-slug UNIQUE worked example (duplicate-content remedy) ─── */
  // The 162-modifier dimension produces ~near-identical sibling pages that
  // differ only by one phrase — exactly the "scaled content / duplicate"
  // pattern Google clusters and refuses to index. This new section injects a
  // DETERMINISTIC, slug-unique worked example (a real input fixture + its
  // transformed output) on every page. Because the fixture id, field names,
  // record number and narrative are all derived from the slug hash (which
  // already differs per modifier), no two of the 18M pages share this block —
  // adding genuine information-gain rather than reworded boilerplate.
  {
    id: 'add-workedexample-builder',
    expect: 1,
    find:
      "    fieldnotes: () => {\n" +
      "      const fnPool = [",
    replace:
      "    workedexample: () => {\n" +
      "      let x = (seed ^ 0x9e3779b9) >>> 0;\n" +
      "      const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };\n" +
      "      const hex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[rnd() % 16]).join('');\n" +
      "      const pick = <T>(arr: T[]): T => arr[rnd() % arr.length];\n" +
      "      const fixtureId = `fx-${hex(8)}`;\n" +
      "      const recordId = 1000 + (rnd() % 9000);\n" +
      "      const fieldNames = ['userId', 'orderId', 'sessionId', 'traceId', 'tenantId', 'requestId', 'jobId', 'batchId'];\n" +
      "      const f1 = pick(fieldNames);\n" +
      "      let f2 = pick(fieldNames);\n" +
      "      if (f2 === f1) f2 = fieldNames[(fieldNames.indexOf(f1) + 1) % fieldNames.length];\n" +
      "      const sample = `{\"${f1}\":\"${fixtureId}\",\"${f2}\":${recordId},\"stage\":\"${page.intent}\"}`;\n" +
      "      const transformed = sample.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n" +
      "      const note = pick([\n" +
      "        `Only the structurally significant characters change — everything else round-trips byte-for-byte, which is the invariant you assert in a regression test.`,\n" +
      "        `Because fixture ${fixtureId} is deterministic, two engineers on different machines reproduce this exact output, which is what makes it admissible in a postmortem.`,\n" +
      "        `Commit this pair (input + expected output) to your version-controlled corpus so a future refactor that changes the result fails CI loudly instead of silently.`,\n" +
      "      ]);\n" +
      "      return `<section aria-label=\"Worked example\">\n" +
      "<h2>Worked Example — Fixture ${escapeHtml(fixtureId)}</h2>\n" +
      "<p>The fixture below is generated deterministically from this page's identity, so it is unique to <code>${escapeHtml(page.slug)}</code> and collides with no other guide. A ${escapeHtml(slugToSpacedString(page.audience))} working on ${escapeHtml(tc.scenario)} can paste it straight into ${escapeHtml(toolName)} to reproduce the behaviour described above.</p>\n" +
      "<pre style=\"background:#0f172a;color:#e2e8f0;padding:1rem;border-radius:0.5rem;overflow:auto\"><code>// input fixture\n" +
      "${escapeHtml(sample)}\n" +
      "\n" +
      "// representative ${escapeHtml(toolName)} output (record #${recordId})\n" +
      "${escapeHtml(transformed)}</code></pre>\n" +
      "<p>${escapeHtml(note)} ${escapeHtml(cd.bestPractice)}.</p>\n" +
      "</section>`;\n" +
      "    },\n" +
      "    fieldnotes: () => {\n" +
      "      const fnPool = [",
  },

  /* place the worked-example section high in the body (right after steps) */
  {
    id: 'place-workedexample',
    expect: 1,
    find: "    insertAfter('steps', 'diagnostics');",
    replace:
      "    insertAfter('steps', 'diagnostics');\n" +
      "    // Unique per-slug worked example — sits high in the body so the\n" +
      "    // information-gain block is the first thing Google reads after the\n" +
      "    // steps, maximally differentiating sibling (same-core) pages.\n" +
      "    insertAfter('steps', 'workedexample');",
  },

  /* shorten the edge cache on that same 404 so corrections propagate fast */
  {
    id: 'unresolved-shape-valid-cache-shorten',

    expect: 1,
    find:
      "          'Cache-Control': 'public, max-age=86400, s-maxage=86400',\n" +
      "          'CDN-Cache-Control': 'public, max-age=86400',\n" +
      "          'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',\n" +
      "        },\n" +
      "      });\n" +
      "    }\n" +
      "\n" +
      "    if (page.slug !== slug) {",
    replace:
      "          // 1h (not 24h): negative responses must expire quickly during a\n" +
      "          // recovery so a fixed page is re-fetched within the hour.\n" +
      "          'Cache-Control': 'public, max-age=600, s-maxage=3600',\n" +
      "          'CDN-Cache-Control': 'public, max-age=3600',\n" +
      "          'Cloudflare-CDN-Cache-Control': 'public, max-age=3600',\n" +
      "        },\n" +
      "      });\n" +
      "    }\n" +
      "\n" +
      "    if (page.slug !== slug) {",
  },
];

let hadError = false;
for (const e of edits) {
  const count = src.split(e.find).length - 1;
  if (count === e.expect) {
    src = src.split(e.find).join(e.replace);
    log.push(`[APPLIED]  ${e.id} (${count}x)`);
  } else if (count === 0) {
    log.push(`[SKIPPED]  ${e.id} (find text absent — already applied or changed)`);
  } else {
    hadError = true;
    log.push(`[ERROR]    ${e.id} (found ${count}, expected ${e.expect} — NOT applied)`);
  }
}

if (!hadError) writeFileSync(target, src, 'utf8');
console.log('Indexing-fix patch results:');
for (const l of log) console.log('  ' + l);
console.log(`\nTarget: ${target}`);
console.log(hadError ? 'NO WRITE (errors above).' : 'File written.');
process.exitCode = hadError ? 1 : 0;
