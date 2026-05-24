# Diffing Text in Production: Beyond `git diff`

The diff tool every engineer thinks they understand is hiding three classes of failure that only show up at scale. This guide is the senior-engineer version of "I know how to read a diff" — what to do when the diff itself is the bug.

## Why `git diff` lies (sometimes)

A `git diff` is computed by Myers' algorithm with a heuristic time-budget cap. When the cap is hit, the algorithm produces a *valid* diff but not necessarily the *minimal* one. For most code changes you never notice. For three specific patterns the output can be deeply misleading:

1. **Reordered functions in the same file.** Myers may show a deletion of function A and an insertion of function B even when both are unchanged — only their positions swapped. Reviewers reading the diff see "two huge changes" and miss that nothing actually changed.
2. **Whitespace-only changes mixed with logic changes.** A `--ignore-all-space` reading would show the logic change cleanly; the default view buries it inside reformatting noise.
3. **Generated-file churn.** Lockfiles, snapshot tests, and minified assets generate thousands of lines of diff that no human can usefully review. Without a `.gitattributes` entry marking these as `linguist-generated` or `merge=ours`, they swamp the review.

The [Diff Checker](/tools/diff-checker) lets you paste two arbitrary blocks of text and see a side-by-side view with whitespace normalization options — useful when you need to confirm that two production responses, configs, or log lines are actually equivalent rather than just visually similar.

## The three diff modes a senior engineer uses

**Line diff** is the default — fine for code review, useless for prose.

**Word diff** (`git diff --word-diff=color`) is the right tool for documentation, prompt engineering, and any text where lines are paragraphs. It shows which *word* changed, which is what humans actually want to read.

**Semantic diff** computes the diff over the abstract syntax tree, not the text. Tools like `difftastic` or `semantic-diff` show "renamed function from `foo` to `bar`, three call sites updated" instead of 200 lines of textual delta. For language-server-aware diffing in code review, this is now table stakes.

## Diffing JSON, YAML, and other structured data

Textual diff of structured data is almost always the wrong tool. A re-ordered map produces a huge textual diff but zero semantic change. The right approach:

1. Canonicalize first (sorted keys, normalized whitespace, consistent string quoting).
2. Diff the canonical form.
3. Display the diff alongside the original form so reviewers see the change in context.

For ad-hoc structured-data diffing, paste both versions into the [JSON Formatter](/tools/json-formatter) first to get a canonical form, then paste the two canonicalized outputs into the [Diff Checker](/tools/diff-checker). The two-step workflow takes 15 seconds and eliminates 90% of false-positive diffs.

## The "diff of a diff" trap

When you bisect a regression and produce a patch that "fixes" the issue, **diff your patch against the originally-reported change**. If the two diffs do not share the same hunks, your patch is masking the bug rather than fixing it. This is one of the most common ways subtle bugs survive code review: the engineer "fixed" a symptom in a different file and the actual bug remains.

## Tooling for production incident response

During an incident, the diffing question is rarely "what changed in the code?" but rather "what changed in the configuration that this code reads?" Configuration is rarely versioned with the same rigor as code, so:

- Take a snapshot of the relevant config at every deploy and store it for at least 90 days.
- During an incident, diff the current config against the last-known-good snapshot before touching anything else.
- If the diff is empty, the regression is in the code or the data. If it is non-empty, that diff is your first hypothesis.

The 10-minute investment in config snapshotting saves hours during the next incident.

## Operational checklist

- [ ] Code reviews use a semantic-diff tool for at least the high-risk files (auth, billing, data migration).
- [ ] Generated files (lockfiles, snapshots, minified bundles) are marked `linguist-generated` or excluded from diff display.
- [ ] Prose and documentation changes are reviewed with `--word-diff`.
- [ ] Structured-data files are canonicalized before diffing (sorted keys, normalized whitespace).
- [ ] Configuration snapshots are taken at every deploy and retained for 90+ days.
- [ ] When applying a regression fix, the fix diff is compared against the original change diff to confirm symmetry.

Diffing is one of the cheapest superpowers in a senior engineer's toolkit. The cost of doing it badly is a code review culture where "looks fine" is the default and real bugs are caught only in production.
