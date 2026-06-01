# Basic Diffing Techniques for Reviews and Debugging

Comparing text and code is fundamental to development workflows. From code reviews to debugging configuration changes, understanding diff techniques helps you identify changes quickly and accurately.

## What is Diffing?

Diffing compares two pieces of text and identifies:
- **Additions**: Content in the new version but not the old
- **Deletions**: Content in the old version but not the new
- **Modifications**: Lines that changed between versions

The output shows exactly what changed, making it easier to review and understand modifications.

## Common Diff Use Cases

### Code Review
Compare proposed changes against the current codebase to understand what a pull request modifies.

### Configuration Debugging
When settings stop working, compare current configuration against a known-good version.

### Document Versioning
Track changes between document revisions to understand evolution over time.

### API Response Comparison
Compare expected vs actual API responses to identify discrepancies.

### Database Schema Changes
Diff schema definitions to understand migration requirements.

## Line-Based vs Character-Based Diff

### Line-Based Diff
Compares text line by line. Best for:
- Code files
- Configuration files
- Structured documents

Our [Diff Checker](/tools/diff-checker) uses line-based comparison, which works well for most development needs.

### Character-Based Diff
Compares character by character within lines. Better for:
- Prose and documentation
- Single-line changes
- Finding subtle differences

## Reading Diff Output

Standard diff notation:
- Lines starting with `-` were removed
- Lines starting with `+` were added
- Lines without prefix are unchanged (context)
- Line numbers help locate changes in original files
