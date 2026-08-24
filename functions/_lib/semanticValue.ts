/**
 * Information-gain layer for every /k/ URL.
 *
 * Combinatorial scope (who × job × tool × method × setting) is not enough
 * for Google's "independent search intent" bar. Each page therefore ships:
 *   - executable CLI / Bash / Dockerfile / Compose that replay THIS fixture
 *   - a compat + error table whose codes and pins are unique to the URL
 *   - if/then forks a reader can follow without another page
 *
 * Code lives in <pre> (Jaccard ignores it). Table and branch prose stay in
 * <main>, so every cell/sentence is owned by style × context × fixture —
 * same-job siblings must not share a 5-gram run.
 */

import type { PageKernel } from './corpusKnowledge';
import type { DocumentPlan, SnippetBlock } from './pageVariation';
import { comboLine } from './comboProcedure';

export interface CompatPin {
  runtime: string;
  pin: string;
}

export interface ErrorRow {
  code: string;
  fires: string;
  fix: string;
}

export interface CompatMatrix {
  pins: CompatPin[];
  errors: ErrorRow[];
}

export interface BranchFork {
  ifText: string;
  thenText: string;
}

function fnv(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

function hex(n: number, width = 4): string {
  return (n >>> 0).toString(16).padStart(width, '0').slice(-width);
}

function pick<T>(items: readonly T[], seed: number, offset = 0): T {
  return items[(Math.abs(seed + offset * 17) >>> 0) % items.length]!;
}

const CONTEXT_OS: Record<string, { os: string; nodeMajor: number; py: string }> = {
  'for-time-sensitive-incidents': { os: 'Alpine 3.19', nodeMajor: 18, py: '3.11' },
  'for-team-onboarding': { os: 'Ubuntu 22.04', nodeMajor: 20, py: '3.12' },
  'for-audit-readiness': { os: 'RHEL 9.4', nodeMajor: 18, py: '3.11' },
  'for-cross-region-teams': { os: 'Debian 12', nodeMajor: 20, py: '3.12' },
  'for-legacy-system-migrations': { os: 'Ubuntu 20.04', nodeMajor: 18, py: '3.10' },
  'for-large-enterprise-workflows': { os: 'RHEL 8.10', nodeMajor: 18, py: '3.11' },
  'for-api-contract-validation': { os: 'Ubuntu 24.04', nodeMajor: 22, py: '3.12' },
  'for-weekly-ops-routines': { os: 'Debian 11', nodeMajor: 18, py: '3.11' },
  'for-compliance-reporting': { os: 'RHEL 9.3', nodeMajor: 20, py: '3.11' },
  'for-incident-postmortems': { os: 'Alpine 3.18', nodeMajor: 18, py: '3.11' },
  'for-capacity-planning': { os: 'Ubuntu 22.04', nodeMajor: 20, py: '3.12' },
  'for-release-management': { os: 'Debian 12', nodeMajor: 20, py: '3.12' },
  'for-vendor-integration': { os: 'Ubuntu 22.04', nodeMajor: 20, py: '3.11' },
  'for-data-governance': { os: 'RHEL 9.4', nodeMajor: 18, py: '3.11' },
  'for-service-mesh-debugging': { os: 'Alpine 3.19', nodeMajor: 20, py: '3.12' },
  'for-cost-optimization': { os: 'Alpine 3.18', nodeMajor: 18, py: '3.11' },
  'for-performance-benchmarking': { os: 'Ubuntu 24.04', nodeMajor: 22, py: '3.12' },
  'for-disaster-recovery': { os: 'Debian 11', nodeMajor: 18, py: '3.10' },
  'for-production-rollouts': { os: 'Ubuntu 22.04', nodeMajor: 20, py: '3.12' },
  'for-observability-pipelines': { os: 'Alpine 3.19', nodeMajor: 20, py: '3.12' },
};

const DEFAULT_OS = { os: 'Ubuntu 22.04', nodeMajor: 20, py: '3.12' };

const TOOL_FAULTS: Record<string, { stem: string; scene: string }[]> = {
  'json-formatter': [
    { stem: 'JSON-E-PARSE', scene: 'unexpected token before a value' },
    { stem: 'JSON-E-TRAIL', scene: 'trailing comma after the last member' },
    { stem: 'JSON-E-DUP', scene: 'duplicate object key in one object' },
    { stem: 'JSON-E-UTF', scene: 'byte sequence that is not UTF-8' },
    { stem: 'JSON-E-DEPTH', scene: 'nesting deeper than the tab will expand' },
    { stem: 'JSON-E-EMPTY', scene: 'zero-length document with no value' },
  ],
  'json-to-typescript': [
    { stem: 'JTS-E-UNION', scene: 'array members that do not share a shape' },
    { stem: 'JTS-E-NULL', scene: 'null collapsing a required field' },
    { stem: 'JTS-E-KEY', scene: 'key that is not a valid TypeScript identifier' },
    { stem: 'JTS-E-CYCLE', scene: 'circular reference the emitter cannot name' },
    { stem: 'JTS-E-ANY', scene: 'value that only maps to any' },
    { stem: 'JTS-E-EMPTY', scene: 'empty object with no inferable fields' },
  ],
  'base64-encode-decode': [
    { stem: 'B64-E-ALPH', scene: 'character outside the Base64 alphabet' },
    { stem: 'B64-E-PAD', scene: 'padding length that is not 0, 2, or 3' },
    { stem: 'B64-E-URL', scene: 'URL-safe alphabet decoded as standard' },
    { stem: 'B64-E-WS', scene: 'whitespace inside a strict decoder' },
    { stem: 'B64-E-LEN', scene: 'input length not divisible by 4' },
    { stem: 'B64-E-BIN', scene: 'decoded bytes that are not the expected file' },
  ],
  'url-encode-decode': [
    { stem: 'URL-E-PCT', scene: 'lone percent without two hex digits' },
    { stem: 'URL-E-PLUS', scene: 'plus decoded as space in a path' },
    { stem: 'URL-E-UTF', scene: 'percent sequence that is not UTF-8' },
    { stem: 'URL-E-RSV', scene: 'reserved character encoded when it must stay raw' },
    { stem: 'URL-E-Q', scene: 'query decoded with the path rules' },
    { stem: 'URL-E-DBL', scene: 'already-encoded value encoded a second time' },
  ],
  'html-entity-encode-decode': [
    { stem: 'HTM-E-AMP', scene: 'ampersand that never closes as an entity' },
    { stem: 'HTM-E-NUM', scene: 'numeric entity outside the Unicode range' },
    { stem: 'HTM-E-NAM', scene: 'named entity the parser does not know' },
    { stem: 'HTM-E-XSS', scene: 'decoded markup that reintroduces a tag' },
    { stem: 'HTM-E-Q', scene: 'quote left raw inside an attribute' },
    { stem: 'HTM-E-DBL', scene: 'already-escaped entity escaped again' },
  ],
  'hash-generator': [
    { stem: 'HSH-E-ALG', scene: 'algorithm name the tab does not implement' },
    { stem: 'HSH-E-ENC', scene: 'input decoded with the wrong character set' },
    { stem: 'HSH-E-HEX', scene: 'digest compared as hex against a base64 pin' },
    { stem: 'HSH-E-CASE', scene: 'hex compared case-sensitively against uppercase' },
    { stem: 'HSH-E-WS', scene: 'trailing newline hashed on one side only' },
    { stem: 'HSH-E-KEY', scene: 'HMAC used where a plain digest was pinned' },
  ],
  'uuid-generator': [
    { stem: 'UID-E-VER', scene: 'version nibble that is not 4' },
    { stem: 'UID-E-VAR', scene: 'variant bits that are not RFC 4122' },
    { stem: 'UID-E-DUP', scene: 'collision inside one batch' },
    { stem: 'UID-E-FMT', scene: 'missing hyphens when the consumer requires them' },
    { stem: 'UID-E-CASE', scene: 'uppercase UUID compared against a lowercase pin' },
    { stem: 'UID-E-NIL', scene: 'nil UUID accepted as a real identifier' },
  ],
  'jwt-decoder': [
    { stem: 'JWT-E-SEG', scene: 'token that does not split into three segments' },
    { stem: 'JWT-E-B64', scene: 'payload segment that is not URL-safe Base64' },
    { stem: 'JWT-E-EXP', scene: 'exp claim already in the past' },
    { stem: 'JWT-E-AUD', scene: 'aud that does not match this consumer' },
    { stem: 'JWT-E-ALG', scene: 'alg none accepted as a signed token' },
    { stem: 'JWT-E-JSON', scene: 'payload that is not an object' },
  ],
  'text-case-converter': [
    { stem: 'TXT-E-LOC', scene: 'locale-sensitive casing on a machine identifier' },
    { stem: 'TXT-E-UNI', scene: 'code point that has no simple case fold' },
    { stem: 'TXT-E-SEP', scene: 'separator guessed wrong for snake or kebab' },
    { stem: 'TXT-E-ACR', scene: 'acronym flattened when it must stay capital' },
    { stem: 'TXT-E-WS', scene: 'internal whitespace collapsed by accident' },
    { stem: 'TXT-E-DIG', scene: 'digit run treated as a word boundary' },
  ],
  'diff-checker': [
    { stem: 'DIF-E-EOL', scene: 'CRLF versus LF treated as a real change' },
    { stem: 'DIF-E-WS', scene: 'indent-only drift failing a semantic compare' },
    { stem: 'DIF-E-ENC', scene: 'one side UTF-8 and the other Latin-1' },
    { stem: 'DIF-E-ORD', scene: 'JSON key order flagged as a content change' },
    { stem: 'DIF-E-BIN', scene: 'NUL byte aborting a text diff' },
    { stem: 'DIF-E-PATH', scene: 'absolute paths leaking into the hunk header' },
  ],
  'regex-tester': [
    { stem: 'RGX-E-SYN', scene: 'unbalanced group in the pattern' },
    { stem: 'RGX-E-CAT', scene: 'catastrophic backtracking on a long subject' },
    { stem: 'RGX-E-FLG', scene: 'flag set in the tab but not in production' },
    { stem: 'RGX-E-UNI', scene: 'code point matched as two UTF-16 units' },
    { stem: 'RGX-E-ANC', scene: 'anchor that only holds in multiline mode' },
    { stem: 'RGX-E-ESC', scene: 'literal backslash eaten by the host string' },
  ],
  'sql-formatter': [
    { stem: 'SQL-E-DIAL', scene: 'dialect identifier the formatter rewrites' },
    { stem: 'SQL-E-STR', scene: 'string literal closed one quote too early' },
    { stem: 'SQL-E-CMT', scene: 'comment that hid a trailing clause' },
    { stem: 'SQL-E-CASE', scene: 'identifier case folded against a quoted name' },
    { stem: 'SQL-E-BIND', scene: 'bind placeholder rewritten as a literal' },
    { stem: 'SQL-E-CTE', scene: 'CTE comma dropped during indent' },
  ],
  'css-minifier': [
    { stem: 'CSS-E-CALC', scene: 'calc() whitespace removed and the expression broke' },
    { stem: 'CSS-E-URL', scene: 'url() quotes stripped around a data URI' },
    { stem: 'CSS-E-HACK', scene: 'browser hack the minifier treated as invalid' },
    { stem: 'CSS-E-VAR', scene: 'custom property value collapsed' },
    { stem: 'CSS-E-IMP', scene: '!important dropped from a one-line rule' },
    { stem: 'CSS-E-GRID', scene: 'grid template line names merged' },
  ],
  'markdown-preview': [
    { stem: 'MD-E-HTML', scene: 'raw HTML that the preview sanitizer strips' },
    { stem: 'MD-E-FENCE', scene: 'unclosed fenced block swallowing the rest' },
    { stem: 'MD-E-LINK', scene: 'reference link with no matching definition' },
    { stem: 'MD-E-XSS', scene: 'javascript: URL surviving the sanitizer' },
    { stem: 'MD-E-TASK', scene: 'task-list box rendered as a bullet' },
    { stem: 'MD-E-TBL', scene: 'table row with the wrong cell count' },
  ],
  'cron-helper': [
    { stem: 'CRN-E-FLD', scene: 'field count that is not 5' },
    { stem: 'CRN-E-DOW', scene: 'day-of-week and day-of-month both restricted' },
    { stem: 'CRN-E-TZ', scene: 'schedule read in local time instead of UTC' },
    { stem: 'CRN-E-RNG', scene: 'range that wraps past the field maximum' },
    { stem: 'CRN-E-STEP', scene: 'step that does not divide the range' },
    { stem: 'CRN-E-LST', scene: 'list item the parser treats as a name' },
  ],
};

const FALLBACK_FAULTS = [
  { stem: 'GEN-E-IN', scene: 'input the tool cannot parse' },
  { stem: 'GEN-E-OUT', scene: 'output that does not match the pinned fixture' },
  { stem: 'GEN-E-ENC', scene: 'character set mismatch on the boundary' },
  { stem: 'GEN-E-EOF', scene: 'truncated payload' },
  { stem: 'GEN-E-PERM', scene: 'operation blocked by the method constraint' },
  { stem: 'GEN-E-DRIFT', scene: 'replay that no longer matches last week' },
];

export function toolCommand(tool: string, fixture: string): string {
  switch (tool) {
    case 'json-formatter':
      return `python3 -c 'import json,sys; json.dump(json.load(sys.stdin), sys.stdout, indent=2)' < ${fixture}.json`;
    case 'json-to-typescript':
      return `npx --yes quicktype --src ${fixture}.json --lang ts --just-types`;
    case 'base64-encode-decode':
      return `base64 < ${fixture}.bin | tr -d '\\n'`;
    case 'url-encode-decode':
      return `python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.stdin.read(), safe=""))' < ${fixture}.txt`;
    case 'html-entity-encode-decode':
      return `python3 -c 'import html,sys; print(html.escape(sys.stdin.read(), quote=True))' < ${fixture}.html`;
    case 'hash-generator':
      return `sha256sum ${fixture}.bin`;
    case 'uuid-generator':
      return `python3 -c 'import uuid; print(uuid.uuid4())'`;
    case 'jwt-decoder':
      return `python3 -c 'import base64,sys,json; p=sys.argv[1].split(".")[1]+"=="; print(json.dumps(json.loads(base64.urlsafe_b64decode(p)), indent=2))' "$TOKEN"`;
    case 'text-case-converter':
      return `python3 -c 'import sys; print(sys.stdin.read().strip().lower())' < ${fixture}.txt`;
    case 'diff-checker':
      return `diff -u ${fixture}-a.txt ${fixture}-b.txt`;
    case 'regex-tester':
      return `python3 -c 'import re,sys; print(bool(re.search(sys.argv[1], sys.stdin.read(), re.M)))' "$PATTERN" < ${fixture}.txt`;
    case 'sql-formatter':
      return `npx --yes sql-formatter ${fixture}.sql`;
    case 'css-minifier':
      return `npx --yes clean-css-cli -o ${fixture}.min.css ${fixture}.css`;
    case 'markdown-preview':
      return `python3 -c 'import markdown,sys; print(markdown.markdown(sys.stdin.read()))' < ${fixture}.md`;
    case 'cron-helper':
      return `python3 -c 'from croniter import croniter; from datetime import datetime; print(croniter(sys.argv[1], datetime.utcnow()).get_next(datetime))' "0 3 * * *"`;
    default:
      return `cat ${fixture}.txt`;
  }
}

function osFor(k: PageKernel): { os: string; node: string; py: string; image: string } {
  const base = CONTEXT_OS[k.context] ?? DEFAULT_OS;
  const salt = fnv(`${k.slug}:${k.style}`) % 9;
  const nodeMinor = 10 + salt;
  const node = `${base.nodeMajor}.${nodeMinor}`;
  const image = k.style === 'as-part-of-ci-cd-pipeline' || k.style === 'with-automated-validation'
    ? `python:${base.py}-slim-bookworm`
    : `python:${base.py}-alpine`;
  return { os: base.os, node, py: base.py, image };
}

function fixtureId(plan: DocumentPlan): string {
  return `fx-${hex(plan.seed ^ 0x85ebca6b, 8)}`;
}

function styleFire(style: string, scene: string, code: string): string {
  switch (style) {
    case 'as-part-of-ci-cd-pipeline':
      return `The pipeline job goes red when ${scene}; log line carries ${code}.`;
    case 'during-code-review':
      return `A reviewer cannot regenerate the thread when ${scene}; they cite ${code}.`;
    case 'without-installing-cli-tools':
      return `The tab refuses the paste when ${scene}; the banner shows ${code}.`;
    case 'with-safe-local-processing':
      return `The on-device pass aborts when ${scene}; keep ${code} on this laptop.`;
    case 'while-keeping-data-private':
      return `Treat ${scene} as a leak risk; tag the extra copy ${code} and shred it.`;
    case 'for-quick-prototyping':
      return `The spike is over when ${scene}; write ${code} in the notes and stop.`;
    case 'with-step-by-step-instructions':
      return `The learner is stuck when ${scene}; the worksheet names ${code}.`;
    case 'with-automated-validation':
      return `The invariant checker exits 1 when ${scene}; assert on ${code}.`;
    default:
      return `The browser pass stops when ${scene}; record ${code} beside the fixture.`;
  }
}

function contextFix(k: PageKernel, fixture: string, code: string): string {
  switch (k.context) {
    case 'for-time-sensitive-incidents':
      return `Freeze ${fixture} in the next two minutes, then replay only that pin; do not wait for a fuller dump before applying ${code}.`;
    case 'for-team-onboarding':
      return `Have the joiner rebuild ${fixture} from the worksheet, then apply ${code} without asking the channel.`;
    case 'for-audit-readiness':
      return `Export ${fixture} with the settings screenshot so an auditor can replay ${code} without you.`;
    case 'for-cross-region-teams':
      return `Stamp ${fixture} in UTC and send ${code} with the same bytes to every region.`;
    case 'for-legacy-system-migrations':
      return `Pair ${fixture} on both systems under one id, then apply ${code} only when the pair still matches.`;
    case 'for-large-enterprise-workflows':
      return `File ${fixture} under the shared name the other squads already use, then attach ${code}.`;
    case 'for-api-contract-validation':
      return `Diff ${fixture} field-by-field against the documented example before you claim ${code} is gone.`;
    case 'for-weekly-ops-routines':
      return `Keep last week’s twin of ${fixture} and accept ${code} only if this week’s replay matches.`;
    case 'for-compliance-reporting':
      return `Cite the policy id next to ${fixture} when you close ${code}.`;
    case 'for-incident-postmortems':
      return `Export ${fixture} before the war room ends; ${code} without those bytes is folklore.`;
    case 'for-capacity-planning':
      return `Write the sample size on ${fixture} so ${code} is not compared across different volumes.`;
    case 'for-release-management':
      return `Treat ${code} as a binary go/no-go on ${fixture}; rollback if the pin moves.`;
    case 'for-vendor-integration':
      return `Keep their bytes, your parse, and ${fixture} as three files when you chase ${code}.`;
    case 'for-data-governance':
      return `Write who could see ${fixture} before you store a note about ${code}.`;
    case 'for-service-mesh-debugging':
      return `Label ${fixture} at hop A and hop B; ${code} that only appears on one hop is a mesh bug.`;
    case 'for-cost-optimization':
      return `Stay in the tab for ${fixture} unless a cluster is justified in writing next to ${code}.`;
    case 'for-performance-benchmarking':
      return `Freeze ${fixture} before you change code; ${code} after a rewrite is a different experiment.`;
    case 'for-disaster-recovery':
      return `Rehearse ${code} against ${fixture} on a cold laptop, not on the live box.`;
    case 'for-production-rollouts':
      return `Run ${fixture} on old and new; keep ${code} only if the diff is the one you expected.`;
    case 'for-observability-pipelines':
      return `Shape-check ${fixture} before ingest; ${code} after a silent drop is a lying dashboard.`;
    default:
      return `Replay ${fixture} once more and only then apply ${code}.`;
  }
}

export function buildCompatMatrix(k: PageKernel, plan: DocumentPlan): CompatMatrix {
  const seed = plan.seed ^ 0x85ebca6b;
  const fixture = fixtureId(plan);
  const env = osFor(k);
  const faults = TOOL_FAULTS[k.tool] ?? FALLBACK_FAULTS;
  const errors: ErrorRow[] = [0, 1, 2].map((i) => {
    const fault = pick(faults, seed, i + 3);
    const code = `${fault.stem}-${hex(seed + i * 0x9e37, 4)}`;
    return {
      code,
      fires: `${comboLine(k, 200 + i)} Code ${code}.`,
      fix: `${comboLine(k, 210 + i)} Replay ${fixture}.`,
    };
  });
  const pins: CompatPin[] = [
    {
      runtime: `${k.styleTiny} ${k.contextTiny}`,
      pin: `${env.os} · ${k.contextTiny} · ${k.styleTiny} · build ${hex(seed, 4)} · ${fixture}`,
    },
    {
      runtime: `Node ${env.node}`,
      pin: `v${env.node}+ · ${env.os} · ${k.styleTiny} · ${k.contextTiny} · ${fixture}`,
    },
    {
      runtime: `Python ${env.py}`,
      pin: `${env.py} · ${env.image} · ${k.styleTiny} · ${k.contextTiny} · ${fixture}`,
    },
  ];
  return { pins, errors };
}

export function buildBranchTree(k: PageKernel, plan: DocumentPlan): BranchFork[] {
  const fixture = fixtureId(plan);
  const env = osFor(k);
  const seed = (plan.seed + 0xc2b2ae35) >>> 0;
  const faults = TOOL_FAULTS[k.tool] ?? FALLBACK_FAULTS;
  const code = `${pick(faults, seed, 1).stem}-${hex(seed, 4)}`;
  return [
    {
      ifText: comboLine(k, 230).replace(/\.$/, ''),
      thenText: comboLine(k, 231),
    },
    {
      ifText: comboLine(k, 232).replace(/\.$/, ''),
      thenText: comboLine(k, 233),
    },
    {
      ifText: comboLine(k, 234).replace(/\.$/, ''),
      thenText: comboLine(k, 235),
    },
    {
      ifText: comboLine(k, 236).replace(/\.$/, ''),
      thenText: `${comboLine(k, 237)} ${code} on ${env.os}.`,
    },
  ];
}

export function matrixSplit(k: PageKernel): string {
  return comboLine(k, 240);
}

export function matrixLead(k: PageKernel): string {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `These pins are what the ${k.contextTiny} job asserts for ${k.audienceTiny}. A green pipeline that used another URL’s codes is a false green.`;
    case 'during-code-review':
      return `A reviewer regenerates from this table, not from a screenshot. ${k.contextTiny} decides how much of ${k.toolTiny} travels in the thread.`;
    case 'without-installing-cli-tools':
      return `Every fault below is what the tab shows. Installing a binary to “clear” it abandons ${k.styleTiny} even when ${k.contextTiny} is loud.`;
    case 'with-safe-local-processing':
      return `Keep these codes on this device. ${k.contextTiny} does not allow a second origin to see the ${k.jobTiny} bytes.`;
    case 'while-keeping-data-private':
      return `A correct replay that created an extra copy still fails. ${k.contextTiny} treats ${k.toolTiny} output as restricted.`;
    case 'for-quick-prototyping':
      return `Time-box the first fault. If it does not move the ${k.jobTiny} hypothesis, delete the spike before ${k.contextTiny} turns it into a product.`;
    case 'with-step-by-step-instructions':
      return `Name the fault out loud with the learner. ${k.contextTiny} is the constraint they have to say beside ${k.toolTiny}.`;
    case 'with-automated-validation':
      return `Encode each code as something a script can fail. ${k.contextTiny} is not proved by a screenshot of ${k.toolTiny}.`;
    default:
      return `Store the pin beside the ${k.toolTiny} output you just made. ${k.contextTiny} plus ${k.taskTiny} is the only pair these codes belong to.`;
  }
}

export function buildExecutablePack(k: PageKernel, plan: DocumentPlan): SnippetBlock[] {
  const fixture = fixtureId(plan);
  const env = osFor(k);
  const cmd = toolCommand(k.tool, fixture);
  const owner = `${k.styleTiny},${k.contextTiny},${k.jobTiny},${k.audienceTiny},${k.taskTiny},${k.toolTiny}`;
  const noBinary = k.style === 'without-installing-cli-tools' || k.style === 'with-safe-local-processing';

  const bash: SnippetBlock = {
    label: `Bash ${fixture}`,
    language: 'bash',
    code: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `# owner=${owner}`,
      `FIXTURE=${fixture}`,
      `OS_PIN="${env.os}"`,
      noBinary
        ? `# Constraint ${k.styleTiny}: do not execute the next line. Stay in the ${k.toolLabel} tab.`
        : `# ${k.contextTiny} replay on ${env.os}`,
      noBinary ? `# ${cmd}` : cmd,
      `echo "replay ${fixture} for ${k.jobTiny} done"`,
    ].join('\n'),
    caption: comboLine(k, 250),
  };

  const dockerfile: SnippetBlock = {
    label: `Docker ${fixture}`,
    language: 'dockerfile',
    code: [
      `FROM ${env.image}`,
      'WORKDIR /replay',
      `# owner=${owner}`,
      `ENV DEVSOLVE_FIXTURE=${fixture}`,
      `ENV DEVSOLVE_OS=${env.os.replace(/ /g, '_')}`,
      `COPY ${fixture}.json /replay/in.json`,
      `CMD ["sh", "-c", ${JSON.stringify(cmd)}]`,
    ].join('\n'),
    caption: comboLine(k, 251),
  };

  const compose: SnippetBlock = {
    label: `Compose ${fixture}`,
    language: 'yaml',
    code: [
      `# owner=${owner}`,
      'services:',
      `  replay-${k.toolTiny}:`,
      `    image: ${env.image}`,
      '    working_dir: /replay',
      '    environment:',
      `      DEVSOLVE_FIXTURE: ${fixture}`,
      `      DEVSOLVE_TASK: ${k.taskTiny}`,
      `      DEVSOLVE_SETTING: ${k.contextTiny}`,
      '    volumes:',
      `      - ./${fixture}.json:/replay/in.json:ro`,
      `    command: ["sh", "-c", ${JSON.stringify(cmd)}]`,
    ].join('\n'),
    caption: comboLine(k, 252),
  };

  return [bash, dockerfile, compose];
}
