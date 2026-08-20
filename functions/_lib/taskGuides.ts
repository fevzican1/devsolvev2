/**
 * Job-native independent guides.
 *
 * Style/context still change *how* and *where* the work is done. This module
 * is the missing axis Google's scaled-content test actually asks about:
 * would a reader of "JSON validation for backend production debugging" get
 * the same answer from "JSON validation for frontend code review"? If the
 * body is a formatter tutorial with adjectives swapped, the answer is yes
 * and the URL does not need to be indexed. Each task therefore has its own
 * thesis, evidence, failure, procedure, and FAQ — then the working method
 * (style) only constrains that job, it does not replace it.
 */

import type { KnowledgeSection, PageKernel } from './corpusKnowledge';
import { sentence } from './language';

export interface TaskGuide {
  section: KnowledgeSection;
  steps: string[];
  faqs: { question: string; answer: string }[];
  pitfalls: string[];
}

export function taskGuide(k: PageKernel): TaskGuide {
  const core = taskCore(k);
  return {
    section: {
      id: 'job',
      heading: core.heading,
      paragraphs: [styleJobOpen(k, core.thesis), core.body, core.close],
      list: [
        `Evidence you must keep: ${k.taskEvidence}.`,
        `The usual failure: ${k.taskFailure}.`,
        audienceCapture(k),
        `This setting (${k.contextPhrase}) is what decides which of those fields are mandatory.`,
      ],
    },
    steps: core.steps,
    faqs: core.faqs,
    pitfalls: core.pitfalls,
  };
}

interface TaskCore {
  heading: string;
  thesis: string;
  body: string;
  close: string;
  steps: string[];
  faqs: { question: string; answer: string }[];
  pitfalls: string[];
}

function taskCore(k: PageKernel): TaskCore {
  const t = k.toolLabel;
  const noun = k.jobNoun;
  const doing = k.jobGerund;
  const who = k.audiencePlural;

  switch (k.task) {
    case 'debug-production-issue':
      return {
        heading: `Incident capture for ${doing}`,
        thesis: `This is incident work. ${sentence(t)} is how you read one captured payload, not a tour of the tool.`,
        body: `Change one thing at a time. The first trustworthy sample — with a timestamp, a severity, and the hop that produced it — is the whole deliverable until the fire is down. Pretty-printing while three edits land in production will not tell you which edit stopped the incident.`,
        close: `${sentence(who)} should leave the session able to name the hop, not able to recite every ${t} control. If the payload never left the process you are looking at, you are not debugging production yet.`,
        steps: [
          'Capture one production-shaped payload with a timestamp and the hop that produced it.',
          `Read that payload in ${t} against a known-good fixture from before the incident.`,
          'Name the first field, type, or encoding that diverged — stop exploring once you have it.',
          'Apply one targeted fix; do not bundle refactors into the incident window.',
          'Freeze the capture for the postmortem before you close the tab.',
        ],
        faqs: [
          { question: 'How many payloads should I capture during the incident?', answer: 'One trustworthy sample. A pile of exploratory pastes hides the hop that actually broke.' },
          { question: `What does ${t} decide here?`, answer: `Whether the captured bytes are structurally what you think they are. It does not decide which service to patch.` },
          { question: 'When am I no longer debugging production?', answer: 'When you start changing three things, or when the sample is a toy string from docs instead of the live hop.' },
        ],
        pitfalls: [
          'Changing three things at once so you cannot say which edit stopped the incident.',
          `Using ${t} as a fidget while the incident clock runs, instead of freezing one sample.`,
        ],
      };
    case 'prepare-api-response':
      return {
        heading: `Shipping a response ${who} can contract-test`,
        thesis: `The job is a well-formed API response, not a pretty tree. Status, content-type, and a body that matches the published schema all have to travel together.`,
        body: `A 200 with a body the documented schema would reject is the failure this page exists to catch. ${sentence(t)} is the rehearsal for that check, not a substitute for naming the status line.`,
        close: `Write the example so a consumer of this API can paste it into a contract test. If the docs would reject it, you are not done — even if ${t} printed it neatly.`,
        steps: [
          'Name the status and content-type before you touch the body.',
          `Load the body into ${t} and compare it to the published schema, field by field.`,
          'Keep unknown keys only when the schema says additional properties are allowed.',
          'Store status, headers, and body as one pack a consumer can replay.',
          'Reject a green pretty-print that would fail the contract test.',
        ],
        faqs: [
          { question: 'Is a pretty-printed body enough to ship?', answer: 'No. Status and content-type are part of the response. A schema-invalid 200 is still a defect.' },
          { question: 'What belongs in the pack?', answer: 'Status, content-type, and a body that validates against the same schema the service uses.' },
          { question: `Where does ${t} stop?`, answer: 'After the body is structurally honest. It will not invent a status line you forgot to set.' },
        ],
        pitfalls: [
          'Returning 200 with a body the documented schema would reject.',
          'Documenting an example that contract tests would fail.',
        ],
      };
    case 'clean-up-payload':
      return {
        heading: `Rewrite the payload without silent drops`,
        thesis: `Clean-up means a before/after you can defend. Dropping keys a downstream consumer still needs is not hygiene; it is a regression.`,
        body: `List every field you rewrote. ${sentence(t)} shows the tree so you can see what vanished, not so you can hide a destructive transform behind a tidy indent.`,
        close: `${sentence(who)} should be able to point at the list of rewritten fields. If that list is “we tidied it”, the downstream break will look like their bug.`,
        steps: [
          'Save the original bytes before any rewrite.',
          `Run ${t} on the original and on the candidate so missing keys are visible.`,
          'Write down every field you changed, including nulls and empty strings.',
          'Confirm a downstream consumer still receives the keys it needs.',
          'Keep the before/after pair as the evidence pack.',
        ],
        faqs: [
          { question: 'May I drop keys the producer no longer uses?', answer: 'Only when every consumer has released the old read. Silent drops are the usual outage here.' },
          { question: 'What is the evidence?', answer: 'Before bytes, after bytes, and the list of fields you rewrote.' },
          { question: `Why use ${t} instead of a one-line transform?`, answer: 'So a human can see what the transform deleted. The transform still has to be reviewed as a change.' },
        ],
        pitfalls: [
          'Silently dropping keys that a downstream consumer still needs.',
          'Calling a pretty-print a clean-up and shipping it.',
        ],
      };
    case 'sanitize-user-input':
      return {
        heading: `Sanitization is not encoding`,
        thesis: `The job is making user-provided data safe to process. Encoding for transport is a different act; treating encode as sanitization is how HTML injection returns.`,
        body: `Keep the original string, the sanitizer settings, and the accepted form. ${sentence(t)} can show you the shape after the sanitizer, but it does not choose the allow-list.`,
        close: `${sentence(who)} should be able to say which characters were stripped and why. If the only artefact is an encoded blob pasted into HTML, this page was the wrong procedure.`,
        steps: [
          'Keep the original user string, even if it looks hostile.',
          'Name the sanitizer settings (allow-list, max bytes, HTML allowed or not).',
          `Inspect the accepted form in ${t} without treating encoding as the sanitizer.`,
          'Refuse to insert the result as HTML unless the sanitizer was an HTML sanitizer.',
          'Store original, settings, and accepted form together.',
        ],
        faqs: [
          { question: 'Is URL-encoding or HTML-escaping enough?', answer: 'Only for the context those encodings were designed for. Neither is a general sanitizer.' },
          { question: 'What must I keep?', answer: 'The original string, the sanitizer settings, and the accepted form.' },
          { question: `Can ${t} sanitize for me?`, answer: `No. It shows structure. The allow-list is a decision ${who} still have to write down.` },
        ],
        pitfalls: [
          'Calling encode “sanitization” and inserting the result as HTML.',
          'Throwing away the original string so a false reject cannot be replayed.',
        ],
      };
    case 'prepare-query-parameters':
      return {
        heading: `Encode each pair, not the whole URL`,
        thesis: `Query strings die when someone encodeURIComponent-s an entire URL and destroys the path. Encode each name and value with the rule that part of the URI requires.`,
        body: `Space encoding, repeated arrays, and reserved characters are the whole game. ${sentence(t)} is useful once you can see the pairs; it will not repair a path you already mangled.`,
        close: `${sentence(who)} should be able to point at each pair and the encoding rule it used. If the path came back looking like a query, you encoded the wrong layer.`,
        steps: [
          'Split the URL into scheme, path, query, and fragment before encoding anything.',
          'Encode each query name and value separately with the rule that slot requires.',
          `Inspect the reconstructed query in ${t} or a URL parser — never encode the whole string.`,
          'Decide how spaces and repeated keys are spelled, and write that down.',
          'Round-trip parse the result; if the path changed, you encoded the wrong layer.',
        ],
        faqs: [
          { question: 'Why not encode the whole URL?', answer: 'Because encodeURIComponent on a whole URL destroys slashes in the path and turns a location into garbage.' },
          { question: 'What do I record?', answer: 'Each name/value pair and the encoding rule that part of the URI required.' },
          { question: 'Repeated keys?', answer: 'Pick a rule (repeat vs comma vs array brackets) and keep it. Mixing them is a consumer bug.' },
        ],
        pitfalls: [
          'Encoding a whole URL with encodeURIComponent and destroying the path.',
          'Mixing space-as-plus and space-as-%20 in the same query.',
        ],
      };
    case 'inspect-encoded-payload':
      return {
        heading: `Decode with the alphabet you actually have`,
        thesis: `Inspection means alphabet, padding rule, and the decoded bytes next to the encoded spelling. Decoding with the wrong alphabet and calling the mojibake the source bug is the usual miss.`,
        body: `${sentence(t)} will show you a tree or a string; it will not tell you that you picked URL-safe Base64 when the producer used standard, or the other way around.`,
        close: `${sentence(who)} should leave with the alphabet named. If you only have a decoded guess, you have not inspected the payload.`,
        steps: [
          'Name the encoding (alphabet, padding, wrapping) before you decode.',
          `Decode once in ${t} and put the decoded bytes next to the encoded spelling.`,
          'If the result is mojibake, change the alphabet — do not patch the producer yet.',
          'Confirm a round-trip: encode the decoded bytes and compare to the original spelling.',
          'Record alphabet, padding, and both spellings in the pack.',
        ],
        faqs: [
          { question: 'The decoded text looks wrong. Is the producer broken?', answer: 'Usually you picked the wrong alphabet or padding rule. Round-trip before you file a producer bug.' },
          { question: 'What belongs in the pack?', answer: 'Alphabet, padding rule, encoded spelling, and decoded bytes.' },
          { question: `Does ${t} pick the alphabet?`, answer: 'No. You do. The tool shows the result of the choice you named.' },
        ],
        pitfalls: [
          'Decoding with the wrong alphabet and treating mojibake as the source bug.',
          'Losing padding while copying the encoded spelling out of a log.',
        ],
      };
    case 'trace-request':
      return {
        heading: `A hop list, not a single capture`,
        thesis: `Tracing means the payload shape at each boundary. One capture cannot tell you which layer mutated the bytes.`,
        body: `Label hops with the names the other squad already uses. ${sentence(t)} is applied at each hop until the mutating one is named — that is the whole method.`,
        close: `${sentence(who)} should be able to point at hop A and hop B. If you only have “the payload”, you have not traced the request.`,
        steps: [
          'List the hops (client, ingress, service, egress) before you capture anything.',
          `Capture the payload at hop A and read it in ${t}.`,
          `Capture the same logical request at hop B and read it the same way.`,
          'Name the first hop where field, type, or encoding changed.',
          'Stop. A third exploratory capture is only useful if A and B still match.',
        ],
        faqs: [
          { question: 'Is one capture enough?', answer: 'No. Tracing is a comparison. A single pretty-print is inspection, not a trace.' },
          { question: 'What do I label?', answer: 'The hop name, the timestamp, and the payload shape at that boundary.' },
          { question: `Why ${t} at every hop?`, answer: 'So the comparison is the same reading. Mixing tools between hops invents a false mutation.' },
        ],
        pitfalls: [
          'A single capture that cannot tell you which layer mutated the bytes.',
          'Comparing a log pretty-print at one hop with raw bytes at another.',
        ],
      };
    case 'validate-auth-token':
      return {
        heading: `Claims are not a verify`,
        thesis: `Token work is header, claims, and a verify/fail result. Trusting decoded claims without a signature check is the failure this page is written to stop.`,
        body: `Never put a production token in a ticket. ${sentence(t)} can decode; verification is a separate step you still have to name (algorithm, key source, clock skew).`,
        close: `${sentence(who)} should be able to say “verified” or “failed verify” with the algorithm named. A decoded payload in a screenshot is not validation.`,
        steps: [
          'Use a synthetic or already-expired token; never paste a live production secret.',
          `Decode header and claims in ${t} and write down alg, kid, exp, and the audience claim.`,
          'Run a real signature check against the key you actually use in that environment.',
          'Treat decoded-but-unverified claims as untrusted input.',
          'Record header, claims, and verify/fail — not the production token.',
        ],
        faqs: [
          { question: 'Is decoding the JWT enough?', answer: 'No. Decoding is reading. Validation is a signature check plus claim checks (exp, aud, iss).' },
          { question: 'May I paste the production token into a ticket?', answer: 'No. Use a synthetic fixture. A decoded production token in a tracker is a separate incident.' },
          { question: `What does ${t} prove?`, answer: 'The structure of header and claims. It does not prove the signature unless you also verify.' },
        ],
        pitfalls: [
          'Trusting decoded claims without a signature check.',
          'Pasting a live production token into a ticket or chat.',
        ],
      };
    case 'review-config-change':
      return {
        heading: `Old file, new file, regenerable diff`,
        thesis: `Config review is not a screenshot of a local editor. A second person has to regenerate the old/new diff with the same settings.`,
        body: `${sentence(t)} is how you make the two files comparable. Approving a crop of someone’s desktop is how misconfiguration ships.`,
        close: `${sentence(who)} should refuse a review that cannot be replayed from the thread. If settings are “defaults”, the review is incomplete.`,
        steps: [
          'Get the old file and the new file, not a screenshot of either.',
          `Run ${t} on both with identical settings so the diff is about the change, not the printer.`,
          'Paste a regenerable diff (or fixture ids) into the review thread.',
          'Name backward-compat risks: removed keys, type changes, default flips.',
          'Approve only when a stranger can regenerate the same diff from the thread.',
        ],
        faqs: [
          { question: 'Is a screenshot of the editor enough?', answer: 'No. Screenshots are not regenerable and they hide settings.' },
          { question: 'What if the file is huge?', answer: 'Review the changed region with the same printer settings, and link the full files.' },
          { question: `Why run ${t} on both sides?`, answer: 'So whitespace and indent noise do not masquerade as a config change.' },
        ],
        pitfalls: [
          'Approving a screenshot of a local editor with no settings beside it.',
          'Diffing two pretty-prints that were produced with different indent rules.',
        ],
      };
    case 'migrate-legacy-system':
      return {
        heading: `Semantic equivalence, not a pretty-print match`,
        thesis: `Migration proof is paired fixtures from the old system and the new one, same identifiers. Pretty-print agreement is cosmetics.`,
        body: `Nulls, encodings, and field meaning have to match. ${sentence(t)} shows the trees so you can see a null that became a string; it does not make that safe.`,
        close: `${sentence(who)} should be able to point at a paired identifier that survived the move. If all you have is “they look the same”, you have not migrated.`,
        steps: [
          'Pick identifiers that exist in both systems and freeze paired fixtures.',
          `Read the old record and the new record in ${t} with the same settings.`,
          'Check nulls, encodings, and field meaning — not just key order.',
          'Record every field that changed meaning, even if the spelling looks similar.',
          'Refuse “pretty-print match” as a sign-off.',
        ],
        faqs: [
          { question: 'The trees look identical. Are we done?', answer: 'Not until nulls, encodings, and field meaning match for the paired identifiers.' },
          { question: 'What is the evidence?', answer: 'Paired fixtures from the old system and the new one, same identifiers.' },
          { question: `Where does ${t} help?`, answer: 'Seeing type and encoding drift that a string equality check will miss.' },
        ],
        pitfalls: [
          'Calling pretty-print agreement a migration proof.',
          'Comparing records that do not share an identifier.',
        ],
      };
    case 'prepare-deployment-artifact':
      return {
        heading: `Hash, settings, and a behaviour fixture`,
        thesis: `A release artifact is not “we minified it”. You need a hash, the tool settings, and a behaviour fixture that still passes after the shrink.`,
        body: `Shipping a minify that changed runtime behaviour to save a few bytes is the failure. ${sentence(t)} is the rehearsal for the behaviour check, not the ship button.`,
        close: `${sentence(who)} should be able to re-run the behaviour fixture on rollback. If the only number you have is the byte delta, you packaged a hope.`,
        steps: [
          'Record the pre-minify (or pre-package) behaviour fixture.',
          `Apply the packaging step, then read the result in ${t} or the matching checker.`,
          'Confirm the behaviour fixture still passes.',
          'Store the artifact hash next to the tool settings.',
          'Reject a smaller artifact that changed runtime behaviour.',
        ],
        faqs: [
          { question: 'The artifact is smaller. Ship?', answer: 'Only if the behaviour fixture still passes. Byte count is not a release gate.' },
          { question: 'What do I keep?', answer: 'Artifact hash, tool settings, and a behaviour fixture that still passes.' },
          { question: `Is ${t} the packager?`, answer: 'No. It is how you inspect what the packager did before you promote the file.' },
        ],
        pitfalls: [
          'Shipping a minify that changed runtime behaviour to save a few bytes.',
          'Losing the settings so a rollback cannot reproduce the artifact.',
        ],
      };
    case 'document-api-endpoint':
      return {
        heading: `Docs examples the contract tests would accept`,
        thesis: `Endpoint documentation is wrong when its examples would fail the same schema the service uses. The example is the product.`,
        body: `${sentence(t)} is how you keep the example honest. A prose description with a toy body trains every consumer to send the wrong shape.`,
        close: `${sentence(who)} should paste the example into the contract test and see green. If that would fail, the page is not documentation yet.`,
        steps: [
          'Take the schema the service actually uses, not a remembered sketch.',
          `Build the success-body example in ${t} until it validates.`,
          'Include the status and a realistic error example, not only the happy path.',
          'Run the contract test against the docs example.',
          'Publish only what that test accepts.',
        ],
        faqs: [
          { question: 'Can the example be simplified for readability?', answer: 'You may omit optional fields. You may not invent types or status codes the service does not use.' },
          { question: 'What is the evidence?', answer: 'An example that validates against the same schema the service uses.' },
          { question: `Why ${t} in a docs workflow?`, answer: 'So the example is a real document, not a diagram of one.' },
        ],
        pitfalls: [
          'Docs examples that the contract tests would reject.',
          'Happy-path-only samples that hide the error shape consumers need.',
        ],
      };
    case 'optimize-build-pipeline':
      return {
        heading: `Faster only if the golden file still matches`,
        thesis: `Build optimisation is a before/after duration plus a golden file the faster job still matches. A faster job that no longer fails the invariant is a regression.`,
        body: `${sentence(t)} is how you freeze the golden bytes before you change the job. Timing without a golden is theatre.`,
        close: `${sentence(who)} should be able to show the duration drop and the matching golden. If you only have a faster wall clock, you optimized the wrong thing.`,
        steps: [
          'Freeze a golden file and a duration baseline before changing the job.',
          `Inspect the golden with ${t} so you know what “match” means.`,
          'Make the pipeline change that is supposed to be faster.',
          'Confirm the new job still matches the golden and still fails the negative fixture.',
          'Record before/after duration next to the golden id.',
        ],
        faqs: [
          { question: 'The job is faster. Done?', answer: 'Only if the golden still matches and the negative fixture still fails.' },
          { question: 'What do I keep?', answer: 'Before/after duration plus a golden file the faster job still matches.' },
          { question: `Where does ${t} sit?`, answer: 'Rehearsal to understand the golden, not a replacement for the job clock.' },
        ],
        pitfalls: [
          'A faster job that no longer fails the invariant you cared about.',
          'Changing fixture and job in the same commit so you cannot attribute the speedup.',
        ],
      };
    case 'resolve-merge-conflict':
      return {
        heading: `Both sides, the result, and a replay`,
        thesis: `A merge is not “keep ours”. Both sides, the merge result, and a replay the other author can run are the evidence.`,
        body: `${sentence(t)} makes the two sides comparable. Keeping one side wholesale and calling the conflict resolved is how intent disappears.`,
        close: `${sentence(who)} should be able to hand the replay to the other author. If they cannot run it, you have not resolved the conflict — you have overwritten it.`,
        steps: [
          'Save ours and theirs before any edit.',
          `Read both sides in ${t} (or the matching viewer) with identical settings.`,
          'Produce a merge that preserves the intent of each contributing change.',
          'Write a replay the other author can run without your laptop state.',
          'Refuse “I kept our version” as a resolution.',
        ],
        faqs: [
          { question: 'Can I just keep our side?', answer: 'No. That discards the other author’s intent. The merge has to name what you kept from each side.' },
          { question: 'What is the evidence?', answer: 'Both sides, the merge result, and a replay the other author can run.' },
          { question: `Why ${t}?`, answer: 'So the conflict is about meaning, not about two printers disagreeing.' },
        ],
        pitfalls: [
          'Keeping one side wholesale and calling the conflict resolved.',
          'Resolving in an editor state nobody else can replay.',
        ],
      };
    case 'prepare-security-audit':
      return {
        heading: `A control the auditor can replay`,
        thesis: `Audit prep is a control name, a fixture, and a regenerable pass/fail. A green UI with no provenance will not survive review.`,
        body: `${sentence(t)} can produce the regenerable result. A slide screenshot of that UI is not the control.`,
        close: `${sentence(who)} should be able to hand the pack to someone who was not in the session. If they cannot replay it, you gathered theatre, not evidence.`,
        steps: [
          'Name the control you are claiming (not “we checked security”).',
          'Choose a fixture the auditor is allowed to see; prefer synthetic data.',
          `Produce a pass/fail with ${t} that a stranger can regenerate.`,
          'Store control name, fixture id, settings, result, and time.',
          'Reject a green screenshot with no provenance.',
        ],
        faqs: [
          { question: 'Is a screenshot of the green UI enough?', answer: 'No. The auditor has to regenerate the pass/fail from the pack.' },
          { question: 'What do I keep?', answer: 'Control name, fixture, and a regenerable pass/fail — not a slide screenshot.' },
          { question: `Can I use production secrets as the fixture?`, answer: 'No. Synthetic fixtures are the audit path unless the policy explicitly allows otherwise.' },
        ],
        pitfalls: [
          'A green UI with no provenance the auditor can replay.',
          'Using production secrets as the “evidence”.',
        ],
      };
    case 'generate-test-fixtures':
      return {
        heading: `A positive, a negative, and the assertion each one is for`,
        thesis: `Fixtures are not one happy-path sample. You need a positive, a negative twin, and the assertion each one is for. A sample that cannot fail the test is not a fixture.`,
        body: `${sentence(t)} is how you keep both twins honest. Pretty-printing only the happy path trains the test to be a no-op.`,
        close: `${sentence(who)} should be able to point at the negative twin and say what must fail. If that sentence does not exist, you generated sample data, not fixtures.`,
        steps: [
          'Write the assertion in one sentence before you craft data.',
          `Build a positive fixture in ${t} that must pass that assertion.`,
          'Build a negative twin that must fail the same assertion.',
          'Name both files after the assertion, not after “sample”.',
          'Refuse a suite that only contains the happy path.',
        ],
        faqs: [
          { question: 'Do I really need a negative fixture?', answer: 'Yes. A check that cannot fail is not a check, and a fixture that cannot fail is not a fixture.' },
          { question: 'What is the evidence?', answer: 'A positive fixture, a negative fixture, and the assertion each one is for.' },
          { question: `Why ${t} for test data?`, answer: 'So the twins are real documents with the same shape production will send, not comments in a test file.' },
        ],
        pitfalls: [
          'One happy-path sample that cannot fail the test.',
          'Naming files “sample.json” with no assertion in the name.',
        ],
      };
    default:
      return {
        heading: `The job this page is actually for`,
        thesis: `Finish ${doing} with ${t}, then leave a pack a teammate can replay.`,
        body: `The evidence is input, settings, and output stored together. Treating a pretty-print as a signed decision is the usual miss.`,
        close: `${sentence(who)} should be able to ${k.taskOutcome}.`,
        steps: [
          `Take a production-shaped sample for ${doing}.`,
          `Read it in ${t}.`,
          'Compare against a known-good fixture.',
          'Store input, settings, and output together.',
        ],
        faqs: [
          { question: `How do I finish ${doing}?`, answer: `Load a representative sample, run ${t}, and keep the pack.` },
          { question: 'What is done?', answer: `When you can ${k.taskOutcome}.` },
          { question: 'What is the usual miss?', answer: k.taskFailure },
        ],
        pitfalls: [
          'Treating a pretty-print as a signed decision.',
          'Leaving no pack for the next person.',
        ],
      };
  }
}

function styleJobOpen(k: PageKernel, thesis: string): string {
  switch (k.style) {
    case 'as-part-of-ci-cd-pipeline':
      return `${thesis} After this session, the same capture has to live as a job that fails closed — a screenshot of ${k.toolLabel} is not that job.`;
    case 'during-code-review':
      return `${thesis} The reviewer has to regenerate this from the pull-request comment, not from a war story in chat.`;
    case 'without-installing-cli-tools':
      return `${thesis} The machine cannot take a binary, so ${k.toolLabel} in the browser tab is the only legal runtime for this job.`;
    case 'with-safe-local-processing':
      return `${thesis} Abort if ${k.toolLabel} would have to upload bytes; this job is not allowed to leave the device.`;
    case 'while-keeping-data-private':
      return `${thesis} A correct result that created an extra copy of the payload still fails this job.`;
    case 'for-quick-prototyping':
      return `${thesis} Time-box it. Most of the session should be thrown away; only the fixture that moved the hypothesis stays.`;
    case 'with-step-by-step-instructions':
      return `${thesis} A first-timer has to finish this job from this page alone, with the same pack a veteran would leave.`;
    case 'with-automated-validation':
      return `${thesis} You must be able to state the job in one sentence a script could fail. ${sentence(k.toolLabel)} is the rehearsal for that invariant.`;
    default:
      return `${thesis} Finish it in one ${k.toolLabel} tab you can describe in a ticket.`;
  }
}

function audienceCapture(k: PageKernel): string {
  switch (k.audience) {
    case 'backend-engineer':
      return 'Capture from service logs or the payload that left the process, not from a UI screenshot.';
    case 'frontend-developer':
      return 'Capture from the Network panel (status, content-type, body), not from an in-memory object you already parsed.';
    case 'fullstack-developer':
      return 'Capture both the client-visible body and the server-side log of the same request so the two layers cannot drift in the pack.';
    case 'api-consumer':
      return 'Capture the documented example next to the live response; a mismatch is the finding.';
    case 'integration-engineer':
      return 'Capture both sides of the mapping (theirs and yours) under the same identifier.';
    case 'security-conscious-developer':
      return 'Capture a synthetic twin. Live tokens and production PII do not belong in the pack.';
    case 'ops-engineer':
      return 'Capture the config or payload as deployed, with the environment name, not as it looks on a laptop.';
    case 'devops-engineer':
      return 'Capture the job log and the fixture the job used, so a red build is diagnosable without a laptop state.';
    case 'technical-writer':
      return 'Capture the example that will be published, and run it against the same schema the service uses.';
    case 'data-engineer':
      return 'Capture a record the pipeline will actually ingest, including types that JSON numbers will quietly coerce.';
    case 'mobile-developer':
      return 'Capture the on-the-wire bytes (size and encoding), not the decoded object after a platform SDK touched it.';
    case 'qa-engineer':
      return 'Capture expected and actual as two fixtures with the assertion named on each.';
    case 'site-reliability-engineer':
      return 'Capture hop, severity, and timestamp so the incident timeline can replay this without the live tab.';
    case 'database-administrator':
      return 'Capture the statement or document as the engine stored it, not as a client pretty-printed it.';
    case 'cloud-architect':
      return 'Capture the contract at the service boundary you are signing off, not an interior implementation dump.';
    case 'performance-engineer':
      return 'Capture fixture size and a frozen setting set before you change code; moving both throws the series away.';
    case 'platform-engineer':
      return 'Capture the self-service path a squad would actually use, not a privileged internal shortcut.';
    case 'solution-architect':
      return 'Capture the interoperability sample that the decision record cites, not a vendor slide.';
    case 'tech-lead':
      return 'Capture the pack the next reviewer can run without asking you in chat.';
    case 'release-engineer':
      return 'Capture artifact hash, settings, and a behaviour fixture that still passes after packaging.';
    default:
      return `Capture the sample ${k.audiencePlural} actually work from, not a toy string.`;
  }
}
