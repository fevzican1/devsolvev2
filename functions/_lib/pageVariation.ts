/**
 * Per-URL document variation — genre outline, snippets, job-native copy.
 *
 * Independent guides are not one H2 skeleton with shuffled furniture. Each
 * URL is a job (task) told for a working method (style) in a setting
 * (context) for a reader (audience). Jaccard is a near-duplicate defence,
 * not the definition of independence: the job thesis has to change what a
 * human would actually do.
 */

import { finishPtr, stopPtr, type IntentKernel, type KnowledgeSection, type PageKernel, type ToolKnowledge } from './corpusKnowledge';
import { sentence, withArticle } from './language';
import { taskGuide } from './taskGuides';

export type SectionId =
  | 'takeaways'
  | 'decision'
  | 'job'
  | 'acceptance'
  | 'archetype'
  | 'context'
  | 'artifact'
  | 'audience'
  | 'practice'
  | 'steps'
  | 'example'
  | 'snippets'
  | 'pitfalls'
  | 'comparison'
  | 'glossary'
  | 'faq';

export type SnippetKind = 'json' | 'cli' | 'http' | 'ci' | 'review' | 'jq';

export interface DocumentPlan {
  seed: number;
  order: SectionId[];
  faqCount: number;
  stepCount: number;
  glossaryCount: number;
  comparisonCount: number;
  omit: Set<SectionId>;
  snippetKinds: SnippetKind[];
}

export interface SnippetBlock {
  label: string;
  language: string;
  code: string;
  caption: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

function fnv(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i += 1) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickN<T>(items: T[], n: number, next: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  const count = Math.max(1, Math.min(n, copy.length));
  return copy.slice(0, count);
}

function hex(next: () => number, n: number): string {
  const alphabet = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < n; i += 1) out += alphabet[Math.floor(next() * 16)]!;
  return out;
}

/**
 * Genre-native outlines. Shuffling one universal H2 skeleton was itself the
 * auto-generated signal: every URL looked like the same essay with furniture
 * moved. Independent guides keep a professional order for their genre and
 * drop sections that genre would never carry (a spike has no glossary; a
 * review checklist is not a comparison essay).
 */
const GENRE_OUTLINE: Record<string, { order: SectionId[]; omit: SectionId[] }> = {
  'without-installing-cli-tools': {
    order: ['decision', 'job', 'artifact', 'archetype', 'context', 'steps', 'example', 'snippets', 'acceptance', 'pitfalls', 'audience', 'faq'],
    omit: ['glossary', 'comparison', 'practice', 'takeaways'],
  },
  'directly-in-your-browser': {
    order: ['decision', 'job', 'artifact', 'takeaways', 'steps', 'example', 'snippets', 'archetype', 'context', 'pitfalls', 'audience', 'faq'],
    omit: ['glossary', 'practice', 'comparison'],
  },
  'with-step-by-step-instructions': {
    order: ['decision', 'job', 'artifact', 'takeaways', 'archetype', 'steps', 'example', 'snippets', 'pitfalls', 'glossary', 'audience', 'context', 'faq'],
    omit: ['comparison', 'practice'],
  },
  'with-safe-local-processing': {
    order: ['decision', 'job', 'artifact', 'archetype', 'acceptance', 'context', 'steps', 'example', 'snippets', 'pitfalls', 'audience', 'faq'],
    omit: ['glossary', 'comparison', 'practice', 'takeaways'],
  },
  'while-keeping-data-private': {
    order: ['decision', 'job', 'artifact', 'archetype', 'acceptance', 'context', 'steps', 'example', 'snippets', 'pitfalls', 'audience', 'faq'],
    omit: ['glossary', 'comparison', 'practice', 'takeaways'],
  },
  'for-quick-prototyping': {
    order: ['decision', 'job', 'artifact', 'context', 'archetype', 'steps', 'example', 'snippets', 'pitfalls', 'audience', 'faq'],
    omit: ['glossary', 'comparison', 'practice', 'takeaways', 'acceptance'],
  },
  'during-code-review': {
    order: ['decision', 'job', 'artifact', 'archetype', 'acceptance', 'steps', 'example', 'snippets', 'pitfalls', 'audience', 'context', 'faq'],
    omit: ['glossary', 'comparison', 'practice', 'takeaways'],
  },
  'as-part-of-ci-cd-pipeline': {
    order: ['decision', 'job', 'artifact', 'context', 'archetype', 'acceptance', 'snippets', 'example', 'steps', 'pitfalls', 'comparison', 'audience', 'faq'],
    omit: ['glossary', 'practice', 'takeaways'],
  },
  'with-automated-validation': {
    order: ['decision', 'job', 'artifact', 'context', 'archetype', 'acceptance', 'snippets', 'example', 'steps', 'pitfalls', 'audience', 'faq'],
    omit: ['glossary', 'comparison', 'practice', 'takeaways'],
  },
};

const DEFAULT_OUTLINE: { order: SectionId[]; omit: SectionId[] } = {
  order: ['decision', 'job', 'artifact', 'takeaways', 'archetype', 'steps', 'example', 'snippets', 'pitfalls', 'audience', 'faq'],
  omit: ['glossary', 'comparison', 'practice'],
};

export function planDocument(k: PageKernel): DocumentPlan {
  const seed = fnv(k.slug) ^ 0x9e3779b9;
  const next = rng(seed);
  const faqCount = 3 + Math.floor(next() * 5); // 3–7
  const stepCount = 4 + Math.floor(next() * 5); // 4–8
  const glossaryCount = 3 + Math.floor(next() * 4); // 3–6
  const comparisonCount = 2 + Math.floor(next() * 3); // 2–4

  const genre = GENRE_OUTLINE[k.style] ?? DEFAULT_OUTLINE;
  const omit = new Set<SectionId>(genre.omit);

  const kinds: SnippetKind[] = ['json'];
  if (k.style === 'as-part-of-ci-cd-pipeline' || k.style === 'with-automated-validation') kinds.push('ci');
  else if (k.style === 'during-code-review') kinds.push('review');
  else if (k.style === 'without-installing-cli-tools') kinds.push('jq');
  else kinds.push('cli');
  if (k.cluster === 'api' || k.cluster === 'web' || k.tool === 'jwt-decoder' || k.tool === 'url-encode-decode') {
    kinds.push('http');
  } else if (next() > 0.4) {
    kinds.push('jq');
  }

  return {
    seed,
    order: genre.order.filter((id) => !omit.has(id)),
    faqCount,
    stepCount,
    glossaryCount,
    comparisonCount,
    omit,
    snippetKinds: kinds,
  };
}

/* -------------------------------------------------------------------------- */
/*  Parameterised snippets                                                     */
/* -------------------------------------------------------------------------- */

function modeToken(style: string): string {
  switch (style) {
    case 'without-installing-cli-tools': return 'no-install-tab';
    case 'directly-in-your-browser': return 'interactive-tab';
    case 'with-step-by-step-instructions': return 'teachable-sequence';
    case 'with-safe-local-processing': return 'device-bound';
    case 'while-keeping-data-private': return 'no-extra-copy';
    case 'for-quick-prototyping': return 'timeboxed-spike';
    case 'during-code-review': return 'pr-replay';
    case 'as-part-of-ci-cd-pipeline': return 'pipeline-gate';
    case 'with-automated-validation': return 'invariant-check';
    default: return 'browser-pass';
  }
}

function settingToken(context: string): string {
  return context.replace(/^for-/, '').replace(/-/g, '_');
}

export function uniqueSnippets(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel, plan: DocumentPlan): SnippetBlock[] {
  const next = rng(plan.seed ^ 0x85ebca6b);
  const fixture = `fx-${hex(next, 8)}`;
  const recordId = 1000 + Math.floor(next() * 9000);
  const mode = modeToken(k.style);
  const setting = settingToken(k.context);
  const blocks: SnippetBlock[] = [];

  for (const kind of plan.snippetKinds) {
    if (kind === 'json') blocks.push(jsonSnippet(k, ik, fixture, recordId, mode, setting));
    else if (kind === 'cli') blocks.push(cliSnippet(k, tk, fixture, mode));
    else if (kind === 'http') blocks.push(httpSnippet(k, fixture, recordId, mode, setting));
    else if (kind === 'ci') blocks.push(ciSnippet(k, ik, tk, fixture, mode));
    else if (kind === 'review') blocks.push(reviewSnippet(k, ik, fixture, mode));
    else blocks.push(jqSnippet(k, fixture, mode, setting));
  }
  return blocks;
}

/** Lead-in for the snippets section — style-specific so neighbours do not share a 5-gram run. */
export function snippetLead(k: PageKernel): string {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `Freeze these bytes as the golden file the pipeline job replays. What ${k.contextPhrase} asks for is a named assertion, not a well-named file.`;
    case 'during-code-review':
      return `Paste only what fits in a PR comment. The reviewer has to regenerate the result from the thread, and ${k.contextPhrase} decides how much of the setup travels with it.`;
    case 'without-installing-cli-tools':
      return `Every sample below stays inside the browser tab. Where a command is commented out, running it would break the constraint this guide exists for, however urgent ${k.contextPhrase} feels.`;
    case 'with-safe-local-processing':
      return `Each sample is bound to the device you are reading this on. ${sentence(k.contextPhrase)} does not allow a second origin to see the bytes.`;
    case 'while-keeping-data-private':
      return `Prefer the synthetic fixture. The run has failed if these bytes end up in chat, a ticket, or a second tool, even when the output was correct — that is what ${k.contextPhrase} means in practice.`;
    case 'for-quick-prototyping':
      return `Throwaway samples for a short spike. Promote the winner into a pipeline check; ${k.contextPhrase} is not a reason to ship from a scratch tab.`;
    case 'with-step-by-step-instructions':
      return `Work through the samples in order: input, action, signal. The sequence is the lesson, and ${k.contextPhrase} is the constraint you teach alongside it.`;
    case 'with-automated-validation':
      return `The JSON below is a rehearsal for the invariant. Encode what ${k.contextPhrase} requires as something a script can fail, not as a screenshot.`;
    default:
      return `Label the sample with the working method and the setting so the next person opens the same tab, the same fixture, and the same guide.`;
  }
}

export function exampleNote(k: PageKernel, fixtureId: string): string {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `Fixture ${fixtureId} is what the pipeline job should replay. A pretty-printed log line is not an assertion.`;
    case 'during-code-review':
      return `Fixture ${fixtureId} belongs in the PR comment with settings. The reviewer must regenerate it, not trust a screenshot.`;
    case 'without-installing-cli-tools':
      return `Fixture ${fixtureId} must round-trip in the tab. Installing a binary to “help” abandons the constraint this guide is written for.`;
    case 'with-safe-local-processing':
      return `Fixture ${fixtureId} never leaves this device. Any upload hop invalidates the example.`;
    case 'while-keeping-data-private':
      return `Fixture ${fixtureId} is synthetic on purpose. A correct result that created an extra copy still fails.`;
    case 'for-quick-prototyping':
      return `Fixture ${fixtureId} is spike-only. Keep it if it moved the hypothesis; otherwise delete it.`;
    case 'with-step-by-step-instructions':
      return `Fixture ${fixtureId} is the teaching sample: name the input, the click, and the signal to move on.`;
    case 'with-automated-validation':
      return `Fixture ${fixtureId} is the expected bytes. If a script cannot fail this, you are reading the wrong guide.`;
    default:
      return `Fixture ${fixtureId} belongs to this tab session. Replay it — a pretty-print on its own is not proof.`;
  }
}

function jsonSnippet(
  k: PageKernel,
  _ik: IntentKernel,
  fixture: string,
  recordId: number,
  mode: string,
  setting: string,
): SnippetBlock {
  const extra = extraJsonFields(k, fixture, recordId);
  // Do not repeat job/audience/task here — those 5-grams already sit in the
  // H1 and are identical across style×context neighbours, which inflates Jaccard.
  const body = {
    fixture,
    mode,
    setting,
    recordId,
    ...extra,
  };
  return {
    label: `Fixture ${fixture}`,
    language: 'json',
    code: JSON.stringify(body, null, 2),
    caption: jsonCaption(k, fixture, mode, setting),
  };
}

function jsonCaption(k: PageKernel, fixture: string, mode: string, setting: string): string {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `Commit ${fixture}.json next to the job that replays it. The assertion comes from what ${k.contextPhrase} needs to prove, not from the filename.`;
    case 'during-code-review':
      return `Keep ${fixture} short enough for a comment. Reviewers regenerate it from the thread, not from a direct message.`;
    case 'without-installing-cli-tools':
      return `Fixture ${fixture} is the browser-tab sample. A package manager is out of bounds here even when ${k.contextPhrase} is urgent.`;
    case 'with-safe-local-processing':
      return `Load ${fixture} on this device only. Local-only processing plus ${k.contextPhrase} rules out a second origin.`;
    case 'while-keeping-data-private':
      return `Fixture ${fixture} is the synthetic stand-in. Using it is pointless if the real payload also lands in a ticket.`;
    case 'for-quick-prototyping':
      return `Time-box ${fixture}. If it does not move the hypothesis, delete it before you close the tab.`;
    case 'with-step-by-step-instructions':
      return `Show ${fixture} as the named input, then have the learner say the signal out loud. ${sentence(k.contextPhrase)} is the constraint they have to name too.`;
    case 'with-automated-validation':
      return `Fixture ${fixture} is the positive case. Keep a negative twin that must fail the same check.`;
    default:
      return `Paste ${fixture} into the tab, run it once, and store the output beside the settings you used (${mode}, ${setting}).`;
  }
}

function extraJsonFields(k: PageKernel, fixture: string, recordId: number): Record<string, string | number | boolean> {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return { goldenPath: `tests/fixtures/${k.tool}/${fixture}.json`, failOn: k.intent, exitCode: 1 };
    case 'with-automated-validation':
      return { invariant: k.intent, encoding: 'utf-8', compare: 'canonical-bytes' };
    case 'during-code-review':
      return { prCommentBudgetBytes: 1800, replayFromThread: true, snippetId: fixture };
    case 'without-installing-cli-tools':
      return { runtime: 'browser-tab', packageManager: 'forbidden', binary: 'none' };
    case 'with-safe-local-processing':
      return { egress: false, originBound: true, device: 'this-tab' };
    case 'while-keeping-data-private':
      return { classification: 'restricted', extraCopies: 0, redactScreenshots: true };
    case 'for-quick-prototyping':
      return { timeboxMinutes: 15, throwaway: true, promoteFixture: fixture };
    case 'with-step-by-step-instructions':
      return { lessonId: `${k.tool}-${recordId}`, teachOrder: 'input-action-signal' };
    default:
      return { loop: 'paste-run-read', tabSession: fixture };
  }
}

function cliSnippet(k: PageKernel, tk: ToolKnowledge, fixture: string, mode: string): SnippetBlock {
  const cmd = toolCli(k.tool, fixture);
  const allowed = k.style !== 'without-installing-cli-tools' && k.style !== 'with-safe-local-processing';
  return {
    label: allowed ? `CLI equivalent (not required here)` : `CLI you must not need for this method`,
    language: 'bash',
    code: allowed
      ? `# mode=${mode} fixture=${fixture}\n${cmd}\n# Keep the flags beside the output so ${k.toolLabel} stays replayable.`
      : `# Constraint: ${mode}. Do not install a binary to finish ${k.jobGerund}.\n# Reference only — this is what a laptop with a package manager would have run:\n# ${cmd}\n# Stay in the ${k.toolLabel} tab instead.`,
    caption: allowed
      ? `If you later automate this job, copy these flags. Keep the verification written under Acceptance criteria next to the output.`
      : `The commented command is there so a reader recognises the equivalent — running it would abandon the constraint this method is written for.`,
  };
}

function toolCli(tool: string, fixture: string): string {
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

function httpSnippet(
  k: PageKernel,
  fixture: string,
  recordId: number,
  mode: string,
  setting: string,
): SnippetBlock {
  return {
    label: `HTTP boundary check`,
    language: 'http',
    code: [
      `POST /debug/${k.tool} HTTP/1.1`,
      `Host: localhost`,
      `Content-Type: application/json`,
      `X-DevSolve-Fixture: ${fixture}`,
      `X-DevSolve-Mode: ${mode}`,
      `X-DevSolve-Setting: ${setting}`,
      `X-Record-Id: ${recordId}`,
      ``,
      `{"job":"${k.intent}","task":"${k.task}","audience":"${k.audience}"}`,
    ].join('\n'),
    caption: `This is a labelled local request, not a call to a hosted debugger. Compare hop-by-hop only when the setting actually involves multiple hops.`,
  };
}

function ciSnippet(
  k: PageKernel,
  ik: IntentKernel,
  tk: ToolKnowledge,
  fixture: string,
  mode: string,
): SnippetBlock {
  return {
    label: `Pipeline sketch for ${k.jobNoun}`,
    language: 'yaml',
    code: [
      `name: ${k.tool}-${k.intent}`,
      `on: [push]`,
      `jobs:`,
      `  ${mode}:`,
      `    runs-on: ubuntu-latest`,
      `    steps:`,
      `      - uses: actions/checkout@v4`,
      `      - name: replay ${fixture}`,
      `        run: |`,
      `          test -f tests/fixtures/${k.tool}/${fixture}.json`,
      `      - name: fail when drift`,
      `        run: echo "assert ${k.intent} did not drift"`,
    ].join('\n'),
    caption: `Port the assertion, not the screenshot. A red job means the invariant moved, not that ${k.toolLabel} is “picky”.`,
  };
}

function reviewSnippet(k: PageKernel, ik: IntentKernel, fixture: string, mode: string): SnippetBlock {
  return {
    label: `PR comment template`,
    language: 'markdown',
    code: [
      `### ${k.jobNoun} replay (${mode})`,
      `- fixture: \`${fixture}\``,
      `- tool: ${k.toolLabel}`,
      `- settings: (paste the same options you used)`,
      `- output: (paste or attach)`,
      `- done when: (${finishPtr(k.style)})`,
      `- reject when: (${stopPtr(k.style)})`,
      ``,
      `_Reviewer: regenerate from this comment only. Do not DM for the sample._`,
    ].join('\n'),
    caption: `Keep the comment under a couple of kilobytes. Production secrets do not belong in the thread.`,
  };
}

function jqSnippet(k: PageKernel, fixture: string, mode: string, setting: string): SnippetBlock {
  return {
    label: `Shape probe on ${fixture}`,
    language: 'bash',
    code: [
      `# ${mode} / ${setting}`,
      `jq '{job:.job, tool:.tool, fixture:.fixture, mode:.mode}' ${fixture}.json`,
      `jq 'paths(scalars) | join(".")' ${fixture}.json | sort`,
    ].join('\n'),
    caption: `A shape probe is not ${k.jobNoun} by itself. It tells you whether the sample you are about to run is the sample you think it is.`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Variable steps / FAQ / glossary / comparison                               */
/* -------------------------------------------------------------------------- */

export function variedSteps(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel, _plan: DocumentPlan): string[] {
  const styleBound = styleBoundStep(k, tk, ik);
  const contextCheck = stepForContext(k);
  // Genre-native procedure plus the setting's extra check. The job thesis
  // (what this URL is actually for) lives in the independent-job section, not
  // as a shared step list stamped onto every working method.
  return [styleBound, ...stepsForStyle(k, tk, ik), contextCheck];
}

function styleBoundStep(k: PageKernel, _tk: ToolKnowledge, ik: IntentKernel): string {
  const t = k.toolLabel;
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `Name the pipeline job after ${k.jobNoun} and fail the build when ${stopPtr(k.style)} is true.`;
    case 'during-code-review':
      return `Approve only when a stranger can regenerate the ${k.jobNoun} from the thread without a direct message.`;
    case 'without-installing-cli-tools':
      return `If a remaining move needs a package manager, you are on the wrong guide — the only runtime here is ${t} in the tab.`;
    case 'with-safe-local-processing':
      return `Write “no egress” beside the output. Any upload hop invalidates the ${k.jobNoun}.`;
    case 'while-keeping-data-private':
      return `A correct ${t} result that created an extra copy of the payload still fails.`;
    case 'for-quick-prototyping':
      return `Do not ship from this tab. Promote the winning fixture into a stricter guide.`;
    case 'with-step-by-step-instructions':
      return `Have the learner say the signal out loud before they click the next control in ${t}.`;
    case 'with-automated-validation':
      return `If you cannot state the ${k.jobNoun} in one sentence a script could fail, you are not done.`;
    default:
      return `Finish when ${finishPtr(k.style)} holds; stop if ${ik.failsWhen}`;
  }
}

function stepsForStyle(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): string[] {
  const t = k.toolLabel;
  const job = k.intentLabel;
  const noun = k.jobNoun;
  const doing = k.jobGerund;
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return [
        `Name the job after ${noun} so logs grep cleanly.`,
        `Commit a positive fixture and a negative fixture next to the test, not in a wiki.`,
        `Record the ${t} options the job must copy (alphabet, indent, dialect).`,
        `Implement the acceptance check as an assertion in CI — not as a screenshot diff.`,
        `Fail the build when ${stopPtr(k.style)} is true.`,
        `On red, diff fixture bytes before touching production config.`,
        `Publish the golden path in the PR template so the next pipeline change is reviewable.`,
        `Keep the browser pass as a rehearsal, not as the gated check.`,
      ];
    case 'during-code-review':
      return [
        `Paste the smallest representative sample under the diff, labelled with a fixture id.`,
        `Run ${t} with the same settings you will ask the reviewer to use.`,
        `Put output + settings in the review thread — not in a DM.`,
        `Ask the reviewer to regenerate from those notes only.`,
        `Approve only when ${finishPtr(k.style)} holds.`,
        `Request changes when ${stopPtr(k.style)} holds.`,
        `Strip secrets before the comment is submitted.`,
        `Link this guide in the thread so the expected size of the evidence is obvious.`,
      ];
    case 'with-step-by-step-instructions':
      return [
        `Write the problem in one sentence the learner can repeat.`,
        `Show the input, then the ${t} action, then the signal that means “move on”.`,
        `Have the learner load a production-shaped sample, not a toy string.`,
        `Stop at each mechanic long enough to say why it exists.`,
        `Confirm ${finishPtr(k.style)} together, out loud.`,
        `Name the pitfall out loud if it appears, using the pitfalls list on this page.`,
        `Leave the evidence pack where a new hire can find it next week.`,
        `Do not skip the “why” even if the click is obvious to you.`,
      ];
    case 'without-installing-cli-tools':
      return [
        `Confirm the machine cannot take a package install (or must not).`,
        `Open ${t} in a throwaway profile if the payload is sensitive.`,
        `Load a representative sample and refuse any “just this once” binary.`,
        `Save output as a file a reviewer can open without extra tools.`,
        `Stop if ${stopPtr(k.style)} is true.`,
        `Finish when ${finishPtr(k.style)} holds.`,
        `If a step requires a CLI, you are reading the wrong guide.`,
        `Record that no install occurred next to the evidence.`,
      ];
    case 'with-safe-local-processing':
      return [
        `Treat upload prompts as abort conditions, not as convenience.`,
        `Load the sample into ${t} on this device only.`,
        `Disable surprising sync (password-manager cloud, extension paste).`,
        `Run ${t} on a production-shaped sample, then read the output against the pack.`,
        `Verify locally using the acceptance check — no other origin.`,
        `Write “no egress” beside the output.`,
        `Done only when ${finishPtr(k.style)} holds.`,
        `If a vendor processor is already approved for bulk work, use the guide written for that path instead.`,
      ];
    case 'while-keeping-data-private':
      return [
        `Classify the payload before you paste anything.`,
        `Prefer a synthetic fixture when the real bytes are restricted.`,
        `Run ${t} without creating a ticket/chat copy of the raw input.`,
        `Redact PII in any screenshot even after a correct result.`,
        `Success includes “no extra copy”, plus ${finishPtr(k.style)}.`,
        `A correct answer that leaked is still a fail.`,
        `If a hosted debugger is required, this guide is the wrong choice.`,
        `Note retention: none, unless your policy says otherwise in writing.`,
      ];
    case 'for-quick-prototyping':
      return [
        `Time-box the tab session before you start.`,
        `State the hypothesis in one line before you open ${t}.`,
        `Try a small sample in ${t} and keep only what moved the hypothesis.`,
        `Keep only the fixture that moved the hypothesis; delete the rest.`,
        `Write the production test you will owe later (${finishPtr(k.style)}).`,
        `Stop if the spike is lying (${stopPtr(k.style)}).`,
        `Do not ship from this tab.`,
        `Promote the winning fixture into the CI/CD or code-review guide next.`,
      ];
    case 'with-automated-validation':
      return [
        `Write the invariant as equality, schema, or digest — not “looks fine”.`,
        `Encode the acceptance check so a script can fail.`,
        `Keep a negative fixture that must fail.`,
        `Name the codec/variant in the assertion message.`,
        `Run ${t} once as a rehearsal, then freeze the expected bytes.`,
        `Breakage is whatever ${stopPtr(k.style)} names.`,
        `Done when ${finishPtr(k.style)} holds.`,
        `If you cannot state the check in one sentence, you are not done.`,
      ];
    default:
      return [
        `Paste a production-shaped sample into ${t}, not a one-line toy.`,
        `Run the loop: paste → run → read against the done-when line.`,
        `Carry out the procedure in the sections above, then compare to a fixture.`,
        `Compare the result to a known-good fixture.`,
        `Copy settings + output into the ticket so someone else can repeat the tab.`,
        `Stop if ${stopPtr(k.style)} is true.`,
        `Finish when ${finishPtr(k.style)} holds.`,
        `Close the tab only after the evidence pack exists.`,
      ];
  }
}

function stepForContext(k: PageKernel): string {
  switch (k.context) {
    case 'for-time-sensitive-incidents':
      return `Cap the first trustworthy sample at minutes, then freeze it for the postmortem — do not keep exploring while the incident clock runs.`;
    case 'for-team-onboarding':
      return `Write the reason under each click so a new hire can finish without Slack lore.`;
    case 'for-audit-readiness':
      return `Store input, settings, output, and time as one evidence pack an external reviewer can replay.`;
    case 'for-cross-region-teams':
      return `Ban relative times and slang; the same bytes must come out in every locale.`;
    case 'for-legacy-system-migrations':
      return `Prove semantic equivalence (nulls, encodings, field meaning), not a pretty-print match.`;
    case 'for-large-enterprise-workflows':
      return `Use the shared fixture names the other squads already know; local nicknames fail this setting.`;
    case 'for-api-contract-validation':
      return `Name the field, type, and encoding that diverged — “payload weird” is not a finding.`;
    case 'for-weekly-ops-routines':
      return `Keep the same few minutes and the same drift signal; surprise is a failure mode.`;
    case 'for-compliance-reporting':
      return `Attach the policy reference to the pack; a green screenshot without provenance is incomplete.`;
    case 'for-incident-postmortems':
      return `Replay from records only — if it needed a live tab state, it will not survive next quarter.`;
    case 'for-capacity-planning':
      return `Note sample size and where the browser path stops being representative of volume.`;
    case 'for-release-management':
      return `Make the check a binary go/no-go that is safe to repeat on rollback.`;
    case 'for-vendor-integration':
      return `Isolate whether the defect is their payload, your parsing, or the transport.`;
    case 'for-data-governance':
      return `Record where the bytes went; a correct answer that created an unapproved copy still fails.`;
    case 'for-service-mesh-debugging':
      return `Apply the same check at each hop until the mutating boundary is identified.`;
    case 'for-cost-optimization':
      return `Prefer the zero-infra tab unless you can write down why a cluster job is mandatory.`;
    case 'for-performance-benchmarking':
      return `Freeze the fixture and settings before comparing runs; changing both invalidates the series.`;
    case 'for-disaster-recovery':
      return `Practice the degraded path that still works when the usual control plane is gone.`;
    case 'for-production-rollouts':
      return `Run the same fixture against old and new; the artifact that matters is the diff.`;
    case 'for-observability-pipelines':
      return `Validate shape before ingest — pipelines drop malformed records quietly.`;
    default:
      return `Keep the evidence pack boring enough to repeat between meetings.`;
  }
}

export function variedFaq(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel, _plan: DocumentPlan): FaqItem[] {
  const job = taskGuide(k);
  const taskFaq = job.faqs[0] ? [{
    question: job.faqs[0].question,
    answer: `${job.faqs[0].answer} ${styleFaqTail(k)}`,
  }] : [];
  return [...taskFaq, ...faqForStyle(k, tk, ik).slice(0, 3), ...faqForContext(k).slice(0, 2)];
}

function styleFaqTail(k: PageKernel): string {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return 'The pipeline job is the source of truth, not a leftover tab.';
    case 'during-code-review':
      return 'If the reviewer cannot replay it from the thread, the answer is incomplete.';
    case 'without-installing-cli-tools':
      return 'A binary install is not a valid workaround on this path.';
    case 'with-safe-local-processing':
      return 'Any hop off this device invalidates the answer.';
    case 'while-keeping-data-private':
      return 'An extra copy of the payload still counts as a fail.';
    case 'for-quick-prototyping':
      return 'Throw the session away if it did not move the hypothesis.';
    case 'with-step-by-step-instructions':
      return 'A first-timer should be able to repeat this answer from the page.';
    case 'with-automated-validation':
      return 'If a script cannot fail the same answer, it is not this guide.';
    default:
      return 'Write the pack down before you close the tab.';
  }
}

function faqForStyle(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): FaqItem[] {
  const t = k.toolLabel;
  const job = k.intentLabel;
  const noun = k.jobNoun;
  const doing = k.jobGerund;
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return [
        { question: `What should the pipeline assert for ${doing}?`, answer: `${sentence(finishPtr(k.style))}, encoded as equality or a schema check — not as a screenshot diff.` },
        { question: `Where does the ${t} golden file live?`, answer: `Next to the test, named after the fixture id. Wiki images go stale and cannot fail a build.` },
        { question: `Is the browser pass the gated check?`, answer: `No. The tab is a rehearsal so you know which options to freeze. The job is the gate.` },
        { question: `What does a red build mean here?`, answer: `The invariant moved. First diff the fixture bytes. False reds often come from ${tk.pitfalls[0] ?? 'an unpinned dialect'}.` },
        { question: `Can I call a hosted API from CI for this?`, answer: `No. That adds egress, flakes, and a vendor as a single point of failure.` },
        { question: `How do I name the job?`, answer: `Include ${k.tool} and ${k.intent} so grep and CODEOWNERS stay obvious.` },
        { question: `When is CI the wrong place for this check?`, answer: `When this is a one-off incident paste that will never become a job.` },
      ];
    case 'during-code-review':
      return [
        { question: `What belongs in the ${noun} review comment?`, answer: `Fixture id, ${t} settings, output, and the done-when line. A reviewer must replay without a DM.` },
        { question: `How long can the snippet be?`, answer: `Short enough for a PR comment. Batch logs belong in a pipeline job.` },
        { question: `May I paste production tokens?`, answer: `No. Redact or use a synthetic fixture. Secrets in review threads are a separate incident.` },
        { question: `Who regenerates the check?`, answer: `The reviewer, from the comment. If they cannot, the artifact is incomplete.` },
        { question: `Approve when?`, answer: `When ${finishPtr(k.style)} holds and the reviewer regenerated from the comment.` },
        { question: `Request changes when?`, answer: `When ${stopPtr(k.style)} holds, or the artifact cannot be replayed from the thread.` },
        { question: `Why not screenshot-only?`, answer: `Screenshots are not regenerable. Settings must travel with the image.` },
      ];
    case 'without-installing-cli-tools':
      return [
        { question: `Can I install a binary “just this once”?`, answer: `No. That abandons the constraint this guide is written for. Use the CLI guide if installs are allowed.` },
        { question: `How do I ${job} on a locked-down laptop?`, answer: `Use ${t} in the browser tab. Save output as a file the reviewer can open without extra tools.` },
        { question: `What if the file is huge?`, answer: `This page is the reference check, not the bulk path. Sample a representative slice.` },
        { question: `Does ${t} need a package manager?`, answer: `No. If a step requires one, you followed the wrong guide.` },
        { question: `How do I prove I did not install anything?`, answer: `Note it next to the evidence pack. The absence of a new binary is part of “done”.` },
        { question: `Throwaway profile?`, answer: `Yes, when the payload is sensitive. Extensions can sync pastes.` },
        { question: `When is this the wrong guide?`, answer: `When a blessed CLI is already on the machine image and the reviewer expects its flags.` },
      ];
    case 'with-safe-local-processing':
      return [
        { question: `Does ${t} upload the sample?`, answer: `No. Abort if any hop asks for egress. Local-only is a hard boundary here.` },
        { question: `What if a vendor processor is already approved?`, answer: `Then bulk speed may belong on a different route. This procedure exists for payloads that must not leave the device.` },
        { question: `How do I verify on-device?`, answer: `Use the acceptance check on this page. Abort if any hop asks for egress.` },
        { question: `Password-manager sync?`, answer: `Treat unexpected cloud sync as egress. Use a profile that does not sync typed data.` },
        { question: `Done when?`, answer: `When ${finishPtr(k.style)} holds and you can write that no egress occurred.` },
        { question: `Failure mode?`, answer: `${sentence(stopPtr(k.style))}, or any hop that left the device.` },
        { question: `May I paste into another origin?`, answer: `No. Another origin is a different processor.` },
      ];
    case 'while-keeping-data-private':
      return [
        { question: `Is a correct ${noun} result enough?`, answer: `No. An extra copy of the data is still a failure.` },
        { question: `Screenshots?`, answer: `Redact PII even after ${t} succeeds.` },
        { question: `Hosted debugger?`, answer: `Wrong trade for secrets. Stay on-device.` },
        { question: `Synthetic fixtures?`, answer: `Prefer them when the real payload is classified.` },
        { question: `Tickets and chat?`, answer: `Do not paste production secrets there either. Link a redacted pack.` },
        { question: `What does ${t} itself do with the bytes?`, answer: `It runs in your browser. The privacy failure is usually the copy you make afterwards.` },
        { question: `Done when?`, answer: `${sentence(finishPtr(k.style))}, plus zero extra copies of the payload.` },
      ];
    case 'for-quick-prototyping':
      return [
        { question: `Is this a release gate?`, answer: `No. It is a time-boxed spike. Promote the winning fixture later.` },
        { question: `How long should the tab stay open?`, answer: `Minutes, not an afternoon. Write the time-box down first.` },
        { question: `What do I keep?`, answer: `Only the fixture that moved the hypothesis.` },
        { question: `What do I owe production?`, answer: `A real test that encodes ${finishPtr(k.style)} — not this tab session.` },
        { question: `When is the spike lying?`, answer: `When ${stopPtr(k.style)} is true, or when the sample was a toy string.` },
        { question: `Can I ship from this tab?`, answer: `No. Shipping needs the stricter acceptance bar of the CI/CD guide.` },
        { question: `Why use ${t} at all?`, answer: `To get a direction without standing up a pipeline you will throw away.` },
      ];
    case 'with-step-by-step-instructions':
      return [
        { question: `Who is this sequence written for?`, answer: `Someone who has not done it before and still needs the same evidence pack.` },
        { question: `What does each stage need?`, answer: `Named input, named ${t} action, named signal to move on.` },
        { question: `Can veterans skip the why?`, answer: `They can use a shorter guide. This one is written to be taught.` },
        { question: `What do I say when it fails mid-lesson?`, answer: `Read ${stopPtr(k.style)} out loud, then name the pitfall from the list below.` },
        { question: `What is done?`, answer: `${sentence(finishPtr(k.style))}, produced by the learner without Slack lore.` },
        { question: `Toy samples?`, answer: `No. Learners will copy whatever you demonstrate.` },
        { question: `Where does the pack live afterwards?`, answer: `Somewhere the next new hire can find without asking you.` },
      ];
    case 'with-automated-validation':
      return [
        { question: `What is the invariant for ${doing}?`, answer: `Whatever ${finishPtr(k.style)} states — equality, schema, or digest, not “looks fine”.` },
        { question: `How do I encode it?`, answer: `Prefer canonical bytes over visual inspection. Name the codec or variant in the assertion message.` },
        { question: `Do I need a negative fixture?`, answer: `Yes. A check that cannot fail is not a check.` },
        { question: `Looks fine?`, answer: `Not an assertion. If you cannot name equality, schema, or hash, run a prototyping pass first.` },
        { question: `Breakage looks like?`, answer: `${sentence(stopPtr(k.style))}. A check that cannot fail is not a check.` },
        { question: `Where does ${t} fit?`, answer: `Rehearsal to freeze expected bytes, then the script owns the gate.` },
        { question: `Assertion message?`, answer: `Name the codec or variant so a red log is diagnosable.` },
      ];
    default:
      return [
        { question: `How do I ${job} with ${t} in one tab?`, answer: `Paste a representative sample, run it, and read the output against a known-good fixture.` },
        { question: `Does the tab replace a pipeline?`, answer: `No. It is the interactive pass. Automate in a pipeline once the options are frozen.` },
        { question: `Toy strings?`, answer: `They hide encoding, null, and size behaviour. Use production-shaped data.` },
        { question: `Done when?`, answer: `When ${finishPtr(k.style)} holds and a teammate can repeat the tab from the ticket.` },
        { question: `Stop when?`, answer: `When ${stopPtr(k.style)} is true, or the sample was a toy string.` },
        { question: `How does a teammate repeat this?`, answer: `From the sample + settings in the ticket, not from a setup novel.` },
        { question: `Does ${t} upload data?`, answer: `No. Do not paste secrets into third-party debuggers either.` },
      ];
  }
}

function faqForContext(k: PageKernel): FaqItem[] {
  switch (k.context) {
    case 'for-time-sensitive-incidents':
      return [
        { question: `How fast must the first sample be during an incident?`, answer: `Minutes. Capture a trustworthy fixture, then stop exploring until the fire is down.` },
        { question: `What survives into the postmortem?`, answer: `The frozen sample and settings. A forgotten tab does not.` },
        { question: `Is elegance in scope?`, answer: `Not here. Speed to evidence ranks first.` },
      ];
    case 'for-audit-readiness':
      return [
        { question: `What does an auditor need to replay the ${k.jobNoun}?`, answer: `Inputs, settings, outputs, and a timestamp. Memory-based “we checked it” fails.` },
        { question: `Is a screenshot enough for audit?`, answer: `Only with the regenerable pack beside it.` },
        { question: `Who regenerates the evidence?`, answer: `Someone who was not in the original session.` },
      ];
    case 'for-service-mesh-debugging':
      return [
        { question: `Where do I apply ${k.toolLabel} in a mesh?`, answer: `At each hop until the mutating boundary shows up.` },
        { question: `Is one capture enough?`, answer: `No. Single-point inspection misses hop comparison.` },
        { question: `What do I label?`, answer: `The hop name, not just “the payload”.` },
      ];
    case 'for-production-rollouts':
      return [
        { question: `Old or new version?`, answer: `Both, same fixture. The interesting artifact is the diff.` },
        { question: `Single-version check?`, answer: `A single-version check belongs in a different guide.` },
        { question: `Rollback?`, answer: `The same pack must be safe to re-run.` },
      ];
    case 'for-observability-pipelines':
      return [
        { question: `Why validate before ingest?`, answer: `Malformed records are dropped quietly; dashboards then lie.` },
        { question: `Is a green UI the ingest check?`, answer: `No. Check the shape the pipeline will parse.` },
        { question: `What do I keep?`, answer: `A rejected-record fixture as well as a happy one.` },
      ];
    case 'for-vendor-integration':
      return [
        { question: `Who can patch the other side?`, answer: `Usually not you. Isolate payload vs parse vs transport.` },
        { question: `Is blame enough?`, answer: `No. A boundary test is the finding.` },
        { question: `What if their schema drifted?`, answer: `Show the field-level diff; then talk to the vendor.` },
      ];
    case 'for-disaster-recovery':
      return [
        { question: `What if the usual CLI fleet is gone?`, answer: `That is why this procedure still has to work in a browser on a cold laptop.` },
        { question: `Happy-path rehearsal?`, answer: `Insufficient. Practice the degraded path.` },
        { question: `Control plane down?`, answer: `Do not invent a step that needs it.` },
      ];
    case 'for-compliance-reporting':
      return [
        { question: `What paper trail is required?`, answer: `What was checked, when, with which inputs, under which policy reference.` },
        { question: `Green screenshot?`, answer: `Not enough without provenance.` },
        { question: `Retention?`, answer: `Follow the policy you cite; do not invent a parallel store.` },
      ];
    default:
      return [
        { question: `How does this setting change the evidence I keep?`, answer: `It changes the pack (timestamps, hops, policy refs), not the core job of ${k.jobGerund}.` },
        { question: `Can I copy a procedure from a different setting?`, answer: `Not and expect the same acceptance bar.` },
        { question: `What stays in scope?`, answer: `${sentence(k.jobNoun)} with ${k.toolLabel} — the setting is a constraint, not a second topic.` },
      ];
  }
}

function faqForTool(k: PageKernel, tk: ToolKnowledge): FaqItem[] {
  return [
    { question: `What does ${k.toolLabel} actually do?`, answer: `The entity block at the top of this page is the definition. This FAQ does not repeat it.` },
    { question: `How do I know ${k.toolLabel} was used correctly?`, answer: `Match the acceptance check on this page. A green pretty-print is not automatically that check.` },
  ];
}

export function variedGlossary(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel, plan: DocumentPlan): { term: string; definition: string }[] {
  const next = rng(plan.seed ^ 0x1b873593);
  const pool = [
    { term: k.toolLabel, definition: `The browser-local DevSolve tool this guide uses to ${k.intentLabel}.` },
    { term: sentence(k.jobNoun), definition: `The single job this guide covers. Related jobs have guides of their own.` },
    { term: 'Working method', definition: `How the work is done here: ${k.stylePhrase}. Other methods have guides of their own.` },
    { term: 'Evidence pack', definition: `What you keep after the run, because this guide is written for ${k.contextPhrase} rather than a generic daily loop.` },
    { term: 'Fixture', definition: `A saved input plus expected output for ${k.jobGerund} that a second person can run without extra context.` },
    { term: 'Canonical bytes', definition: 'The agreed spelling of a result (key order, padding, encoding) so two systems can compare without ad-hoc trim hacks.' },
    { term: 'Replay pack', definition: `Input, ${k.toolLabel} settings, and output stored together.` },
    { term: 'Acceptance', definition: `${sentence(finishPtr(k.style))} — not a second, conflicting definition.` },
  ];
  return pickN(pool, plan.glossaryCount, next);
}

export function variedComparison(k: PageKernel, plan: DocumentPlan): { item: string; pros: string; cons: string }[] {
  const next = rng(plan.seed ^ 0x7f4a7c15);
  const pool = [
    {
      item: `${k.toolLabel} in this working method`,
      pros: `Keeps the work ${k.stylePhrase}, which is the constraint this guide assumes.`,
      cons: `The wrong choice when a different working method was actually available.`,
    },
    {
      item: `Same tool, this delivery setting ignored`,
      pros: `Faster if the setting truly does not apply.`,
      cons: `You will keep the wrong evidence (no hops, no audit trail, no time-box).`,
    },
    {
      item: 'CLI of the same family',
      pros: 'Scriptable once installed; better on huge files.',
      cons: 'Blocked on locked-down laptops; version skew across machines.',
    },
    {
      item: 'Hosted debugger',
      pros: 'Convenient UI.',
      cons: 'Egress and retention. Wrong for private payloads.',
    },
    {
      item: 'Ad-hoc script in the ticket',
      pros: 'Maximum control.',
      cons: `Easy to miss ${withArticle(k.toolLabel)} rule unless a fixture is kept.`,
    },
    {
      item: 'Pipeline job without a rehearsal',
      pros: 'Runs unattended.',
      cons: 'You will pin the wrong flags. Rehearse in the tab first.',
    },
  ];
  return pickN(pool, plan.comparisonCount, next);
}

export function variedPitfalls(k: PageKernel, tk: ToolKnowledge, _ik: IntentKernel, _plan: DocumentPlan): string[] {
  const job = taskGuide(k);
  return [
    job.pitfalls[0] ?? `Treating a green ${k.toolLabel} UI as done.`,
    tk.pitfalls[0] ?? 'Treating a UI result as a signed production decision.',
    `Skipping the extra check this setting asks for: ${stepForContext(k)}`,
  ];
}

export function variedIntro(k: PageKernel, tk: ToolKnowledge, ik: IntentKernel): string[] {
  const t = k.toolLabel;
  const job = k.intentLabel;
  const noun = k.jobNoun;
  const doing = k.jobGerund;
  return [
    introLead(k, ik, t, job),
    introSetting(k),
    introEvidence(k),
    introWrongUrl(k, t, job),
  ];
}

function introEvidence(k: PageKernel): string {
  const keep = k.taskEvidence;
  const fail = k.taskFailure;
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `The job log should still show ${keep}. A green build that hid “${fail}” is a false green.`;
    case 'during-code-review':
      return `The review thread should contain ${keep}. If the thread cannot explain “${fail}”, request changes.`;
    case 'without-installing-cli-tools':
      return `Keep ${keep} as a file that opens without extra tools. Installing a binary to dodge “${fail}” abandons this guide.`;
    case 'with-safe-local-processing':
      return `Keep ${keep} on this device. Uploading to “fix” “${fail}” is still egress.`;
    case 'while-keeping-data-private':
      return `Keep ${keep} without creating an extra copy. “${fail}” plus a leak is two failures.`;
    case 'for-quick-prototyping':
      return `Keep ${keep} only if it moved the hypothesis. Do not spend the time-box on “${fail}”.`;
    case 'with-step-by-step-instructions':
      return `The learner should be able to point at ${keep}. Call out “${fail}” when it happens.`;
    case 'with-automated-validation':
      return `Encode ${keep} so a script can fail. “${fail}” should be a red assertion, not a comment.`;
    default:
      return `Keep ${keep}. The usual failure here is ${fail}.`;
  }
}

function introSetting(k: PageKernel): string {
  switch (k.context) {
    case 'for-time-sensitive-incidents':
      return `You are on an incident clock: one trustworthy sample beats a long exploratory session.`;
    case 'for-team-onboarding':
      return `Treat every click as curriculum — a new hire should finish from this page alone.`;
    case 'for-audit-readiness':
      return `The output is not the deliverable; the regenerable evidence pack is.`;
    case 'for-cross-region-teams':
      return `No live handover: write times, locales, and bytes so they mean the same thing in every region.`;
    case 'for-legacy-system-migrations':
      return `Pretty-print agreement is not a migration proof. Field meaning and encodings have to match.`;
    case 'for-large-enterprise-workflows':
      return `Use the names other squads already know. Local nicknames make this setting fail.`;
    case 'for-api-contract-validation':
      return `A finding names a field, a type, and an encoding — not “the payload looks weird”.`;
    case 'for-weekly-ops-routines':
      return `This is supposed to be boring: same minutes, same drift signal, no surprise theatre.`;
    case 'for-compliance-reporting':
      return `Cite the policy next to the pack. A green screenshot without provenance will not survive review.`;
    case 'for-incident-postmortems':
      return `Write as if a stranger will replay this next quarter from records, with no live tab left over.`;
    case 'for-capacity-planning':
      return `Record how big the sample was and where a browser tab stops representing production volume.`;
    case 'for-release-management':
      return `The gate wants a binary go/no-go you can repeat on rollback, not a maybe.`;
    case 'for-vendor-integration':
      return `You cannot patch the other side. A boundary test has to say which layer actually broke.`;
    case 'for-data-governance':
      return `Lineage is in scope: where the bytes sat matters as much as whether the answer was correct.`;
    case 'for-service-mesh-debugging':
      return `Compare hops. A single capture cannot tell you which boundary mutated the payload.`;
    case 'for-cost-optimization':
      return `The cheap path is this tab unless you can write down why a cluster job is mandatory.`;
    case 'for-performance-benchmarking':
      return `Freeze the fixture before you change code. Moving both in one session throws the series away.`;
    case 'for-disaster-recovery':
      return `Practice the path that still works when the usual control plane is missing.`;
    case 'for-production-rollouts':
      return `Old and new, same fixture. The rollout artifact is the diff between them.`;
    case 'for-observability-pipelines':
      return `Shape-check before ingest. Pipelines drop bad records without a loud error.`;
    default:
      return `Keep the evidence pack small enough to repeat between meetings.`;
  }
}

function introWrongUrl(k: PageKernel, t: string, job: string): string {
  const noun = k.jobNoun;
  const doing = k.jobGerund;
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `Skip this guide if ${doing} is a one-off paste that will never become a job — here ${t} is a rehearsal for a build gate, not a souvenir screenshot.`;
    case 'during-code-review':
      return `Skip this guide if nobody will regenerate the ${noun} from a PR comment. ${t} output that only lives in Slack is the wrong artifact.`;
    case 'without-installing-cli-tools':
      return `Skip this guide if a blessed CLI is already on the machine image and reviewers expect its flags. Here the browser tab is the only runtime.`;
    case 'with-safe-local-processing':
      return `Skip this guide if an approved vendor processor is already the path for ${doing} in bulk. The procedure here aborts on upload.`;
    case 'while-keeping-data-private':
      return `Skip this guide if creating a ticket copy of the raw input is acceptable. A correct ${t} result that leaked is still a failure.`;
    case 'for-quick-prototyping':
      return `Skip this guide if you already owe a production test for ${doing}. Here ${t} is a time-boxed spike, not the ship path.`;
    case 'with-step-by-step-instructions':
      return `Skip this guide if the reader already knows why each ${t} click exists. This is the teachable ${noun} path.`;
    case 'with-automated-validation':
      return `Skip this guide if you cannot state the ${noun} in one sentence a script could fail. ${t} is the rehearsal for that invariant.`;
    default:
      return `Skip this guide if you only wanted the ${t} tool page. The job here is ${doing}, with a written done-when line.`;
  }
}

function introLead(k: PageKernel, _ik: IntentKernel, t: string, job: string): string {
  const who = k.audiencePlural;
  const scene = k.taskScenario;
  const noun = k.jobNoun;
  const doing = k.jobGerund;
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `When ${who} are ${scene}, ${noun} cannot live as a screenshot. Rehearse it in ${t}, then freeze the same check as a job that fails closed.`;
    case 'during-code-review':
      return `When ${who} are ${scene}, a reviewer should replay the ${noun} from the thread. ${t} is how you produce that small, regenerable artifact.`;
    case 'without-installing-cli-tools':
      return `When ${who} are ${scene} on a machine that cannot take a binary, ${t} in the browser tab is the only legal runtime for ${doing}.`;
    case 'with-safe-local-processing':
      return `When ${who} are ${scene}, the payload must not leave this device. Abort if ${t} would have to upload bytes to finish ${doing}.`;
    case 'while-keeping-data-private':
      return `When ${who} are ${scene}, a correct ${noun} result that created an extra copy still fails. Stay on ${t} in this tab.`;
    case 'for-quick-prototyping':
      return `When ${who} are ${scene} and only need a direction, time-box ${doing} in ${t} and throw most of the session away.`;
    case 'with-step-by-step-instructions':
      return `When ${who} are ${scene} and a first-timer has to finish, this is the teachable ${noun} path on ${t}: named input, named action, named signal.`;
    case 'with-automated-validation':
      return `When ${who} are ${scene}, ${doing} needs a statement a script can fail. ${t} is the rehearsal for that invariant, not the whole check.`;
    default:
      return `When ${who} are ${scene}, finish ${doing} in one ${t} tab you can describe in a ticket.`;
  }
}

export function variedTakeaways(k: PageKernel, ik: IntentKernel): string[] {
  const extra = takeawayPair(k, ik);
  return [
    takeawayJob(k, ik),
    `The extra check this setting adds: ${stepForContext(k)}`,
    extra[0]!,
    extra[1]!,
  ];
}

function takeawayJob(k: PageKernel, ik: IntentKernel): string {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `A green job means ${ik.doneWhen} A red job means ${ik.failsWhen}`;
    case 'during-code-review':
      return `Approve only if a stranger can regenerate the ${k.jobNoun} from the thread without a direct message.`;
    case 'without-installing-cli-tools':
      return `If a step needs a package manager, stop — this page is the no-install path for ${k.jobGerund}.`;
    case 'with-safe-local-processing':
      return `Done includes “no egress”. A correct ${k.toolLabel} result that uploaded still fails.`;
    case 'while-keeping-data-private':
      return `Done includes “no extra copy”. Tickets, chat, and screenshots are in scope.`;
    case 'for-quick-prototyping':
      return `Keep the fixture that moved the hypothesis; delete the rest before the time-box ends.`;
    case 'with-step-by-step-instructions':
      return `A first-timer should finish ${k.jobGerund} with the same pack as a veteran, from this page alone.`;
    case 'with-automated-validation':
      return `If you cannot state the ${k.jobNoun} in one sentence a script could fail, you are not done.`;
    default:
      return `${sentence(k.jobNoun)} is finished when ${ik.doneWhen}`;
  }
}

function takeawayPair(k: PageKernel, _ik: IntentKernel): [string, string] {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return ['The tab is rehearsal; the job is the gate.', 'A red build means fixture drift, not taste.'];
    case 'during-code-review':
      return ['The artifact must be regenerable from the PR comment.', 'Secrets do not belong in the thread.'];
    case 'without-installing-cli-tools':
      return ['A binary install abandons the constraint this guide is written for.', 'Save output as a file that opens without extra tools.'];
    case 'with-safe-local-processing':
      return ['Any upload prompt is an abort.', 'Write “no egress” beside the output.'];
    case 'while-keeping-data-private':
      return ['A correct result that created an extra copy still fails.', 'Redact screenshots even after success.'];
    case 'for-quick-prototyping':
      return ['Time-box first; throw most of it away.', 'Do not ship from this tab.'];
    case 'with-step-by-step-instructions':
      return ['Name the input, the action, and the signal to move on.', 'The next new hire should finish without Slack lore.'];
    case 'with-automated-validation':
      return ['If it cannot fail a script, it is not this page.', 'Keep a negative fixture that must fail.'];
    default:
      return ['Paste a production-shaped sample, not a toy string.', 'Leave a pack a teammate can replay from the ticket.'];
  }
}

export function variedAcceptance(k: PageKernel, _tk: ToolKnowledge, _ik: IntentKernel, _plan: DocumentPlan): string[] {
  return [
    `The sample resembles production data for ${k.jobGerund}, not a one-line toy.`,
    `You accounted for ${k.audienceConcern}, which is what ${k.audiencePlural} most often miss here.`,
    `Evidence for this job is complete: ${k.taskEvidence}.`,
    `The usual failure did not happen: ${k.taskFailure}.`,
    `A second person can replay the tab from the pack without a direct message.`,
  ];
}

export function contextArtifact(k: PageKernel): KnowledgeSection {
  const rows = artifactRows(k);
  return {
    id: 'artifact',
    heading: artifactHeading(k),
    paragraphs: [
      `Keep this list beside the ${k.toolLabel} result. ${sentence(k.contextPhrase)} is what decides which fields matter, and writing them down is what stops the next person from inventing a different pack.`,
    ],
    list: rows,
  };
}

function artifactHeading(k: PageKernel): string {
  switch (k.context) {
    case 'for-time-sensitive-incidents': return 'Incident clock (T+0 / T+15 / T+60)';
    case 'for-team-onboarding': return 'What the new hire must leave with';
    case 'for-audit-readiness': return 'Evidence fields an auditor will ask for';
    case 'for-cross-region-teams': return 'Handover-free checklist';
    case 'for-legacy-system-migrations': return 'Equivalence proof, not cosmetics';
    case 'for-large-enterprise-workflows': return 'Squad-standard labels';
    case 'for-api-contract-validation': return 'Field-level finding template';
    case 'for-weekly-ops-routines': return 'Boring weekly loop';
    case 'for-compliance-reporting': return 'Policy-cited pack';
    case 'for-incident-postmortems': return 'Replay from records';
    case 'for-capacity-planning': return 'Volume notes beside the sample';
    case 'for-release-management': return 'Go / no-go card';
    case 'for-vendor-integration': return 'Boundary isolation';
    case 'for-data-governance': return 'Lineage questions';
    case 'for-service-mesh-debugging': return 'Hop list';
    case 'for-cost-optimization': return 'Zero-infra preference';
    case 'for-performance-benchmarking': return 'Frozen baseline card';
    case 'for-disaster-recovery': return 'Degraded-path rehearsal';
    case 'for-production-rollouts': return 'Old vs new under one fixture';
    case 'for-observability-pipelines': return 'Pre-ingest shape check';
    default: return 'Setting-specific pack';
  }
}

function artifactRows(k: PageKernel): string[] {
  const job = k.intentLabel;
  const noun = k.jobNoun;
  const doing = k.jobGerund;
  switch (k.context) {
    case 'for-time-sensitive-incidents':
      return [
        `T+0: capture one trustworthy ${noun} sample; do not pretty-print forever.`,
        'T+15: freeze settings next to the sample; assign an owner for the pack.',
        'T+60: the pack must still make sense to someone joining the call late.',
      ];
    case 'for-team-onboarding':
      return [
        `A defined term list for ${k.toolLabel} in this job.`,
        'A finished evidence pack the new hire produced without private Slack lore.',
        `The reason behind each click, not only the click itself.`,
      ];
    case 'for-audit-readiness':
      return [
        'Input bytes or a labelled fixture id.',
        `${k.toolLabel} settings spelled out (not “defaults”).`,
        'Output + timestamp + who ran it.',
      ];
    case 'for-service-mesh-debugging':
      return [
        'Hop A capture (client-side).',
        'Hop B capture (after the first proxy).',
        `The same ${noun} at each hop, until the mutating one is named.`,
      ];
    case 'for-production-rollouts':
      return [
        'Old version output under this fixture.',
        'New version output under the same fixture.',
        'The diff, which is the actual rollout artifact.',
      ];
    case 'for-api-contract-validation':
      return [
        'Field name that diverged.',
        'Documented type vs observed type.',
        'Encoding (UTF-8 vs something else) if that is the break.',
      ];
    case 'for-vendor-integration':
      return [
        'Vendor payload as received.',
        'Your parse of that payload.',
        'Transport metadata (status, content-type) if the body never arrived.',
      ];
    case 'for-observability-pipelines':
      return [
        'Record the parser will accept.',
        'Record the parser will drop.',
        'Dashboard query that would lie if the drop is silent.',
      ];
    case 'for-disaster-recovery':
      return [
        'Cold laptop, browser only.',
        `No dependency on the broken control plane to finish ${doing}.`,
        'Written degraded path, practiced, not invented during the outage.',
      ];
    case 'for-compliance-reporting':
      return [
        'Policy identifier you are citing.',
        `What the ${noun} actually checked.`,
        'When, with which fixture, signed or at least attributed.',
      ];
    case 'for-performance-benchmarking':
      return [
        'Frozen fixture id.',
        'Frozen settings.',
        'Run notes (size, repeats) — never change fixture and code in the same session.',
      ];
    case 'for-capacity-planning':
      return [
        'Sample size used in the tab.',
        'Where the browser path stops being representative.',
        'What you will measure next at volume.',
      ];
    case 'for-data-governance':
      return [
        'Where the bytes sat (this device only, unless documented).',
        'Who could see them.',
        'Retention: none, or the named store.',
      ];
    case 'for-release-management':
      return [
        'Binary outcome: go or no-go.',
        `The ${noun} runs fast enough to sit at the gate.`,
        'Safe to repeat on rollback.',
      ];
    default:
      return [
        `A fixture labelled for ${doing}.`,
        `${k.toolLabel} settings written down.`,
        'Output a stranger could regenerate.',
      ];
  }
}

export function entityFraming(k: PageKernel, _tk: ToolKnowledge, _ik: IntentKernel): { name: string; definition: string; alsoKnownAs: string[] } {
  const job = taskGuide(k);
  return {
    name: `${sentence(k.jobNoun)} for ${k.taskPhrase}`,
    definition: `${job.section.paragraphs[1] ?? `${k.intentLabel} using ${k.toolLabel}.`} Working method: ${k.stylePhrase}. Setting: ${k.contextPhrase}.`,
    alsoKnownAs: [k.jobNoun, k.toolLabel, k.taskPhrase],
  };
}
