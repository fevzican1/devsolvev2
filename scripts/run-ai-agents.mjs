#!/usr/bin/env node
/**
 * Free multi-agent indexing + backlink orchestrator.
 *
 * Six local agents, zero LLM spend, zero Cloudflare Function spend:
 *   1. google-indexing-agent
 *   2. bing-guidelines-agent
 *   3. uniqueness-agent
 *   4. language-agent
 *   5. backlink-agent
 *   6. deepseek-indexability-agent (MIT-licensed local policy; no hosted API)
 *   7. semantic-value-agent (executable pack + error matrix + hops)
 *   9. crawl-budget-agent (internal /k/ graph stays inside sitemap ramp)
 *
 * Usage:
 *   node --import tsx scripts/run-ai-agents.mjs
 *   AI_AGENTS_FAST=1 node --import tsx scripts/run-ai-agents.mjs
 *   AI_AGENTS_OFFLINE=1 node --import tsx scripts/run-ai-agents.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { agentBanner, AGENT_VERSION, COST_MODEL } from './lib/ai-indexing-agent.mjs';
import { run as googleRun } from './lib/ai-agents/google-indexing.mjs';
import { run as bingRun } from './lib/ai-agents/bing-guidelines.mjs';
import { run as uniquenessRun } from './lib/ai-agents/uniqueness.mjs';
import { run as languageRun } from './lib/ai-agents/language.mjs';
import { run as backlinkRun } from './lib/ai-agents/backlink.mjs';
import { run as deepseekRun } from './lib/ai-agents/deepseek-indexability.mjs';
import { run as semanticRun } from './lib/ai-agents/semantic-value.mjs';
import { run as gainRun } from './lib/ai-agents/information-gain.mjs';
import { run as crawlRun } from './lib/ai-agents/crawl-budget.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportsDir = join(__dirname, '..', 'out', 'reports');
const fast = process.env.AI_AGENTS_FAST === '1';
const sample = fast ? 24 : 80;
const stems = fast ? 24 : 80;

console.log(agentBanner());
console.log(`mode: ${fast ? 'fast' : 'full sample'} · sample=${sample} · stems=${stems}`);
console.log(`cost model: ${JSON.stringify(COST_MODEL)}`);

const results = [];
results.push(await googleRun({ sample }));
results.push(await bingRun({ sample }));
results.push(await uniquenessRun({ stems }));
results.push(await languageRun({ sample }));
results.push(await backlinkRun({ offline: process.env.AI_AGENTS_OFFLINE === '1' }));
results.push(await deepseekRun({ sample }));
results.push(await semanticRun({ sample }));
results.push(await gainRun({ stems }));
results.push(await crawlRun({ sample, relatedSweep: fast ? 2_000 : 8_000 }));

if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
const report = {
  generated: new Date().toISOString(),
  agentVersion: AGENT_VERSION,
  fast,
  results,
};
writeFileSync(join(reportsDir, 'ai-agents.json'), JSON.stringify(report, null, 2));

let failed = 0;
for (const r of results) {
  const flag = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) failed += 1;
  const extra = r.maxJaccard != null ? ` maxJaccard=${r.maxJaccard}` : r.minScore != null ? ` minScore=${r.minScore}` : '';
  console.log(`${flag}  ${r.agent.id}  scanned=${r.scanned ?? r.stems ?? r.unfurls?.length ?? 0}${extra}`);
  if (!r.ok) {
    for (const f of (r.failures || []).slice(0, 5)) console.log('      ', JSON.stringify(f));
  }
}

if (failed) {
  console.error(`\nFAIL — ${failed} agent(s). Report: out/reports/ai-agents.json`);
  process.exit(1);
}
console.log('\nPASS — every agent cleared its contract. Report: out/reports/ai-agents.json');
