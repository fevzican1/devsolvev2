/**
 * FreshSlugsRotator
 *
 * Surfaces a deterministic-per-build-day rotating set of /k/* deep URLs on
 * hub pages (/tools, /guides). The goal is to give Googlebot a fresh batch
 * of internal links every time it crawls these high-PageRank hubs, so the
 * 18M-page programmatic corpus is continually re-introduced via natural
 * internal-link discovery rather than relying solely on sitemap pings.
 *
 * ZERO RUNTIME COST
 * -----------------
 * This is a SERVER COMPONENT. The rotation is computed once at build time
 * (when Next.js statically generates /tools and /guides). The resulting
 * HTML is pure static markup served from the Cloudflare CDN. No request
 * ever invokes a Cloudflare Function for this block.
 *
 * Determinism: the build-day index is hashed with the slot index to pick
 * URLs from the programmatic universe (TOTAL_POSSIBLE = clusters × tools ×
 * intents × audiences × tasks × modifiers). The same build produces the
 * same HTML across all PoPs (cache-friendly).
 */

import Link from 'next/link';

// Same combinatorial counts as functions/k/[[slug]].ts — keep these in
// sync if either side is changed (they are intentionally duplicated to
// avoid pulling the entire worker module into the Next.js bundle).
const CLUSTERS = [
  { key: 'json', tools: ['json-formatter', 'json-to-typescript'], intents: ['validate-json','format-json','inspect-json-structure','convert-json-to-types','compare-json-objects','transform-json-keys','extract-json-values','merge-json-data','flatten-nested-json','detect-json-syntax-errors','generate-json-schema','minify-json-payload'] },
  { key: 'encoding', tools: ['base64-encode-decode','url-encode-decode','html-entity-encode-decode'], intents: ['encode-data','decode-data','fix-encoding-bugs','convert-character-sets','handle-unicode-text','escape-special-characters','troubleshoot-encoding-mismatch','batch-encode-values','decode-nested-encodings','verify-encoding-roundtrip','convert-binary-to-text','normalize-encoded-output'] },
  { key: 'security', tools: ['hash-generator','uuid-generator','jwt-decoder'], intents: ['generate-identifiers','verify-tokens','inspect-signatures','audit-token-expiry','hash-sensitive-data','generate-secure-keys','validate-jwt-claims','compare-security-hashes','detect-token-tampering','rotate-unique-identifiers','analyze-token-payload','verify-data-integrity'] },
  { key: 'text', tools: ['text-case-converter','diff-checker','regex-tester'], intents: ['normalize-text','compare-versions','test-regex','find-and-replace-patterns','extract-text-segments','convert-text-case','analyze-text-differences','build-regex-patterns','validate-input-format','clean-up-whitespace','split-text-by-delimiter','match-complex-patterns'] },
  { key: 'formatting', tools: ['sql-formatter','css-minifier','markdown-preview'], intents: ['format-sql','minify-assets','preview-markdown','indent-nested-code','optimize-css-output','validate-markdown-syntax','beautify-query-strings','restructure-code-blocks','standardize-sql-style','compress-stylesheet','render-documentation','align-code-formatting'] },
  { key: 'api', tools: ['json-formatter','jwt-decoder','url-encode-decode'], intents: ['design-api-schema','validate-api-response','construct-query-string','authenticate-api-request','parse-webhook-payload','debug-api-error','format-api-documentation','test-api-endpoint','normalize-api-data','optimize-api-payload','version-api-response','secure-api-communication'] },
  { key: 'data', tools: ['json-to-typescript','base64-encode-decode','hash-generator'], intents: ['transform-data-format','generate-data-models','hash-data-for-storage','encode-binary-data','create-data-fingerprint','validate-data-integrity','serialize-complex-objects','migrate-data-schema','anonymize-sensitive-fields','aggregate-data-records','generate-unique-identifiers','normalize-data-structure'] },
  { key: 'debugging', tools: ['diff-checker','regex-tester','json-formatter'], intents: ['compare-config-files','trace-data-flow','isolate-parsing-error','identify-format-change','debug-regex-match','verify-output-format','analyze-log-patterns','pinpoint-encoding-issue','detect-schema-drift','validate-transform-output','reproduce-formatting-bug','check-data-consistency'] },
  { key: 'automation', tools: ['cron-helper','regex-tester','uuid-generator'], intents: ['schedule-recurring-task','extract-log-data','generate-batch-ids','parse-automation-output','validate-cron-schedule','build-extraction-pattern','create-unique-job-ids','monitor-scheduled-tasks','automate-data-extraction','filter-event-streams','tag-automated-processes','configure-periodic-cleanup'] },
  { key: 'web', tools: ['html-entity-encode-decode','css-minifier','markdown-preview'], intents: ['sanitize-html-input','optimize-css-bundle','preview-content-markup','encode-url-parameters','protect-against-xss','minify-stylesheet','render-dynamic-content','escape-template-variables','compress-web-assets','validate-markup-output','format-rich-text','secure-form-data'] },
];
const AUDIENCES = ['backend-engineer','frontend-developer','fullstack-developer','api-consumer','integration-engineer','security-conscious-developer','ops-engineer','devops-engineer','technical-writer','data-engineer','mobile-developer','qa-engineer','site-reliability-engineer','database-administrator','cloud-architect','performance-engineer','platform-engineer','solution-architect','tech-lead','release-engineer'];
const TASKS = ['debug-production-issue','prepare-api-response','clean-up-payload','sanitize-user-input','prepare-query-parameters','inspect-encoded-payload','trace-request','validate-auth-token','review-config-change','migrate-legacy-system','prepare-deployment-artifact','document-api-endpoint','optimize-build-pipeline','resolve-merge-conflict','prepare-security-audit','generate-test-fixtures'];
// Modifier count matches functions/k — 9 styles × 18 contexts = 162.
const MODIFIER_COUNT = 9 * 18;

function buildSlug(clusterKey: string, intent: string, audience: string, task: string, tool: string, index: number): string {
  return [clusterKey, intent, audience, task, tool]
    .join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + `-${index}`;
}

// Tokens that should render as upper-case acronyms rather than Title Case so
// the labels read like real engineering guide titles ("JSON", not "Json").
const ACRONYMS: Record<string, string> = {
  json: 'JSON', jwt: 'JWT', api: 'API', url: 'URL', html: 'HTML',
  uuid: 'UUID', css: 'CSS', sql: 'SQL', qa: 'QA', sre: 'SRE',
  xss: 'XSS', ci: 'CI', cd: 'CD', etl: 'ETL',
};

function prettifyToken(token: string): string {
  const lower = token.toLowerCase();
  if (ACRONYMS[lower]) return ACRONYMS[lower];
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function prettifyPhrase(phrase: string): string {
  return phrase.split('-').filter(Boolean).map(prettifyToken).join(' ');
}

/**
 * Build a human-readable, descriptive label from the structured slug parts.
 * Produces a unique, sentence-like title (not a keyword salad) so the hub
 * never renders multiple visually identical links — which previously read as
 * machine-generated spam and hurt the page's quality signals.
 */
function humanLabel(intent: string, audience: string, tool: string): string {
  return `${prettifyPhrase(intent)} — for a ${prettifyPhrase(audience)} (${prettifyPhrase(tool)})`;
}


/* Build-day rotation: rebuilds at every deploy. Builds on the same UTC day
 * produce identical output, which keeps the static cache stable. */
function buildDayIndex(): number {
  return Math.floor(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  ) / (24 * 3600 * 1000));
}

function pickFreshSlugs(seedSalt: string, count: number): Array<{ slug: string; label: string }> {
  const day = buildDayIndex();
  const out: Array<{ slug: string; label: string }> = [];
  const seen = new Set<string>();

  // Flatten cluster/tool/intent pairs.
  const pairs: Array<{ cluster: string; tool: string; intent: string }> = [];
  for (const c of CLUSTERS) for (const t of c.tools) for (const i of c.intents) {
    pairs.push({ cluster: c.key, tool: t, intent: i });
  }
  const perPair = AUDIENCES.length * TASKS.length * MODIFIER_COUNT;
  const total = pairs.length * perPair;

  // Search a wider window than `count` so that, after de-duplicating by the
  // VISIBLE label, we can still fill every slot with a distinct title.
  for (let slot = 0; slot < count * 12 && out.length < count; slot += 1) {
    // 32-bit hash combining day + salt + slot for deterministic but
    // varied rotation. Same build day → same output.
    let h = 5381;
    const key = `${day}-${seedSalt}-${slot}`;
    for (let i = 0; i < key.length; i += 1) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
    const absIdx = Math.abs(h) % total;
    const pairIdx = Math.floor(absIdx / perPair);
    const rem = absIdx % perPair;
    const audIdx = Math.floor(rem / (TASKS.length * MODIFIER_COUNT));
    const rem2 = rem % (TASKS.length * MODIFIER_COUNT);
    const taskIdx = Math.floor(rem2 / MODIFIER_COUNT);
    const pair = pairs[pairIdx];
    const audience = AUDIENCES[audIdx];
    const task = TASKS[taskIdx];
    const slug = buildSlug(pair.cluster, pair.intent, audience, task, pair.tool, absIdx);
    const label = humanLabel(pair.intent, audience, pair.tool);
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
