/**
 * ============================================================================
 * CLUSTER MAPPING TABLE — EKSİK #2
 * ============================================================================
 *
 * Semantic bridge between editorial guides/tools and the /k/* programmatic corpus.
 * Each guide has explicit mappings to programmatic intents, enabling:
 *   - Guide → /k/ outbound links (editorial spine feeds authority to programmatic)
 *   - /k/ → Guide backlinks (programmatic pages reference authoritative guides)
 *   - Correct cluster matching (guide clusterKeys ≠ programmatic clusterKeys fixed here)
 *
 * This table fulfills `programmaticLinkCountTarget` from the guide registry.
 *
 * NOTE: This is a PURE DATA file. No I/O, no side effects. Safe for edge/build.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClusterMapping {
  /** Guide slug from guideRegistry */
  guideSlug: string;
  /** Programmatic cluster keys this guide maps to */
  programmaticClusters: string[];
  /** Specific intents this guide is most relevant to */
  mappedIntents: string[];
  /** Primary tool(s) from the programmatic side */
  programmaticTools: string[];
  /** Number of /k/ links to inject into guide pages */
  linkCount: number;
  /** Where links should be placed in guide content */
  placement: ('markdown-body' | 'explore-related' | 'sidebar' | 'footer')[];
  /** Priority audiences for this guide's programmatic links */
  priorityAudiences: string[];
  /** Priority tasks for link selection */
  priorityTasks: string[];
}

// ---------------------------------------------------------------------------
// Full Mapping Table (17 guides × programmatic clusters)
// ---------------------------------------------------------------------------

export const CLUSTER_MAPPINGS: readonly ClusterMapping[] = [
  {
    guideSlug: 'json-validation-formatting',
    programmaticClusters: ['json', 'api', 'data'],
    mappedIntents: [
      'validate-json', 'format-json', 'inspect-json-structure',
      'detect-json-syntax-errors', 'minify-json-payload', 'compare-json-objects',
      'validate-api-response', 'normalize-api-data',
    ],
    programmaticTools: ['json-formatter', 'json-to-typescript'],
    linkCount: 18,
    placement: ['markdown-body', 'explore-related', 'footer'],
    priorityAudiences: ['backend-engineer', 'fullstack-developer', 'api-consumer'],
    priorityTasks: ['debug-production-issue', 'prepare-api-response', 'clean-up-payload'],
  },
  {
    guideSlug: 'jwt-decoding-browser',
    programmaticClusters: ['security', 'api'],
    mappedIntents: [
      'verify-tokens', 'inspect-signatures', 'audit-token-expiry',
      'validate-jwt-claims', 'detect-token-tampering', 'analyze-token-payload',
      'authenticate-api-request', 'secure-api-communication',
    ],
    programmaticTools: ['jwt-decoder', 'hash-generator'],
    linkCount: 20,
    placement: ['markdown-body', 'explore-related', 'sidebar'],
    priorityAudiences: ['security-conscious-developer', 'backend-engineer', 'devops-engineer'],
    priorityTasks: ['validate-auth-token', 'prepare-security-audit', 'debug-production-issue'],
  },
  {
    guideSlug: 'hashing-integrity',
    programmaticClusters: ['security', 'data'],
    mappedIntents: [
      'hash-sensitive-data', 'generate-secure-keys', 'compare-security-hashes',
      'verify-data-integrity', 'create-data-fingerprint', 'generate-unique-identifiers',
      'generate-identifiers', 'rotate-unique-identifiers',
    ],
    programmaticTools: ['hash-generator', 'uuid-generator'],
    linkCount: 18,
    placement: ['markdown-body', 'explore-related', 'footer'],
    priorityAudiences: ['security-conscious-developer', 'backend-engineer', 'devops-engineer'],
    priorityTasks: ['prepare-security-audit', 'validate-auth-token', 'generate-test-fixtures'],
  },
  {
    guideSlug: 'regex-testing-debugging',
    programmaticClusters: ['text', 'debugging', 'automation'],
    mappedIntents: [
      'test-regex', 'find-and-replace-patterns', 'build-regex-patterns',
      'match-complex-patterns', 'validate-input-format', 'extract-text-segments',
      'debug-regex-match', 'extract-log-data', 'build-extraction-pattern',
    ],
    programmaticTools: ['regex-tester'],
    linkCount: 22,
    placement: ['markdown-body', 'explore-related', 'sidebar'],
    priorityAudiences: ['backend-engineer', 'devops-engineer', 'qa-engineer'],
    priorityTasks: ['debug-production-issue', 'sanitize-user-input', 'generate-test-fixtures'],
  },
  {
    guideSlug: 'url-encoding-pitfalls',
    programmaticClusters: ['encoding', 'web', 'api'],
    mappedIntents: [
      'encode-data', 'decode-data', 'fix-encoding-bugs',
      'troubleshoot-encoding-mismatch', 'escape-special-characters',
      'encode-url-parameters', 'construct-query-string', 'prepare-query-parameters',
    ],
    programmaticTools: ['url-encode-decode', 'html-entity-encode-decode'],
    linkCount: 18,
    placement: ['markdown-body', 'explore-related', 'footer'],
    priorityAudiences: ['frontend-developer', 'fullstack-developer', 'api-consumer'],
    priorityTasks: ['prepare-query-parameters', 'debug-production-issue', 'sanitize-user-input'],
  },
  {
    guideSlug: 'base64-usage',
    programmaticClusters: ['encoding', 'data', 'api'],
    mappedIntents: [
      'encode-data', 'decode-data', 'convert-binary-to-text',
      'decode-nested-encodings', 'verify-encoding-roundtrip',
      'encode-binary-data', 'batch-encode-values',
    ],
    programmaticTools: ['base64-encode-decode'],
    linkCount: 16,
    placement: ['markdown-body', 'explore-related', 'footer'],
    priorityAudiences: ['backend-engineer', 'fullstack-developer', 'integration-engineer'],
    priorityTasks: ['prepare-api-response', 'inspect-encoded-payload', 'migrate-legacy-system'],
  },
  {
    guideSlug: 'text-transformations',
    programmaticClusters: ['text', 'formatting'],
    mappedIntents: [
      'normalize-text', 'convert-text-case', 'clean-up-whitespace',
      'split-text-by-delimiter', 'extract-text-segments',
      'format-sql', 'beautify-query-strings',
    ],
    programmaticTools: ['text-case-converter', 'sql-formatter'],
    linkCount: 18,
    placement: ['markdown-body', 'explore-related', 'footer'],
    priorityAudiences: ['technical-writer', 'frontend-developer', 'fullstack-developer'],
    priorityTasks: ['clean-up-payload', 'document-api-endpoint', 'review-config-change'],
  },
  {
    guideSlug: 'diffing-techniques',
    programmaticClusters: ['text', 'debugging'],
    mappedIntents: [
      'compare-versions', 'analyze-text-differences',
      'compare-config-files', 'identify-format-change',
      'detect-schema-drift', 'check-data-consistency',
    ],
    programmaticTools: ['diff-checker'],
    linkCount: 15,
    placement: ['markdown-body', 'explore-related', 'footer'],
    priorityAudiences: ['backend-engineer', 'devops-engineer', 'tech-lead'],
    priorityTasks: ['review-config-change', 'resolve-merge-conflict', 'debug-production-issue'],
  },
  {
    guideSlug: 'markdown-preview-safety',
    programmaticClusters: ['formatting', 'web'],
    mappedIntents: [
      'preview-markdown', 'validate-markdown-syntax',
      'render-documentation', 'render-dynamic-content',
      'sanitize-html-input', 'protect-against-xss',
    ],
    programmaticTools: ['markdown-preview', 'html-entity-encode-decode'],
    linkCount: 12,
    placement: ['markdown-body', 'explore-related'],
    priorityAudiences: ['technical-writer', 'frontend-developer', 'fullstack-developer'],
    priorityTasks: ['document-api-endpoint', 'sanitize-user-input', 'review-config-change'],
  },
  {
    guideSlug: 'sql-formatting',
    programmaticClusters: ['formatting', 'data'],
    mappedIntents: [
      'format-sql', 'standardize-sql-style', 'indent-nested-code',
      'beautify-query-strings', 'restructure-code-blocks',
      'align-code-formatting',
    ],
    programmaticTools: ['sql-formatter'],
    linkCount: 20,
    placement: ['markdown-body', 'explore-related', 'sidebar'],
    priorityAudiences: ['database-administrator', 'backend-engineer', 'data-engineer'],
    priorityTasks: ['debug-production-issue', 'review-config-change', 'migrate-legacy-system'],
  },
  {
    guideSlug: 'minification-basics',
    programmaticClusters: ['formatting', 'web'],
    mappedIntents: [
      'minify-assets', 'optimize-css-output', 'compress-stylesheet',
      'compress-web-assets', 'optimize-css-bundle', 'minify-stylesheet',
    ],
    programmaticTools: ['css-minifier'],
    linkCount: 14,
    placement: ['markdown-body', 'explore-related'],
    priorityAudiences: ['frontend-developer', 'performance-engineer', 'fullstack-developer'],
    priorityTasks: ['optimize-build-pipeline', 'prepare-deployment-artifact', 'clean-up-payload'],
  },
  {
    guideSlug: 'json-to-types',
    programmaticClusters: ['json', 'data', 'api'],
    mappedIntents: [
      'convert-json-to-types', 'generate-data-models', 'transform-data-format',
      'generate-json-schema', 'serialize-complex-objects', 'migrate-data-schema',
      'design-api-schema', 'version-api-response',
    ],
    programmaticTools: ['json-to-typescript', 'json-formatter'],
    linkCount: 16,
    placement: ['markdown-body', 'explore-related', 'footer'],
    priorityAudiences: ['fullstack-developer', 'backend-engineer', 'api-consumer'],
    priorityTasks: ['prepare-api-response', 'migrate-legacy-system', 'generate-test-fixtures'],
  },
  {
    guideSlug: 'api-contract-validation-deep-dive',
    programmaticClusters: ['api', 'json', 'debugging'],
    mappedIntents: [
      'validate-api-response', 'design-api-schema', 'parse-webhook-payload',
      'debug-api-error', 'normalize-api-data', 'version-api-response',
      'detect-schema-drift', 'validate-transform-output',
    ],
    programmaticTools: ['json-formatter', 'jwt-decoder', 'diff-checker'],
    linkCount: 24,
    placement: ['markdown-body', 'explore-related', 'sidebar', 'footer'],
    priorityAudiences: ['backend-engineer', 'api-consumer', 'integration-engineer', 'solution-architect'],
    priorityTasks: ['prepare-api-response', 'debug-production-issue', 'validate-auth-token', 'review-config-change'],
  },
  {
    guideSlug: 'token-security-deep-dive',
    programmaticClusters: ['security', 'api'],
    mappedIntents: [
      'verify-tokens', 'inspect-signatures', 'audit-token-expiry',
      'validate-jwt-claims', 'detect-token-tampering', 'analyze-token-payload',
      'hash-sensitive-data', 'generate-secure-keys', 'rotate-unique-identifiers',
      'authenticate-api-request', 'secure-api-communication',
    ],
    programmaticTools: ['jwt-decoder', 'hash-generator', 'uuid-generator'],
    linkCount: 22,
    placement: ['markdown-body', 'explore-related', 'sidebar', 'footer'],
    priorityAudiences: ['security-conscious-developer', 'backend-engineer', 'site-reliability-engineer', 'cloud-architect'],
    priorityTasks: ['validate-auth-token', 'prepare-security-audit', 'debug-production-issue'],
  },
  {
    guideSlug: 'encoding-pitfalls-deep-dive',
    programmaticClusters: ['encoding', 'web', 'data'],
    mappedIntents: [
      'encode-data', 'decode-data', 'fix-encoding-bugs',
      'convert-character-sets', 'handle-unicode-text', 'troubleshoot-encoding-mismatch',
      'decode-nested-encodings', 'verify-encoding-roundtrip', 'normalize-encoded-output',
      'encode-url-parameters',
    ],
    programmaticTools: ['base64-encode-decode', 'url-encode-decode', 'html-entity-encode-decode'],
    linkCount: 22,
    placement: ['markdown-body', 'explore-related', 'sidebar', 'footer'],
    priorityAudiences: ['backend-engineer', 'fullstack-developer', 'integration-engineer', 'mobile-developer'],
    priorityTasks: ['debug-production-issue', 'inspect-encoded-payload', 'migrate-legacy-system', 'sanitize-user-input'],
  },
  {
    guideSlug: 'text-diffing-deep-dive',
    programmaticClusters: ['text', 'debugging'],
    mappedIntents: [
      'compare-versions', 'analyze-text-differences', 'find-and-replace-patterns',
      'compare-config-files', 'trace-data-flow', 'identify-format-change',
      'detect-schema-drift', 'check-data-consistency', 'reproduce-formatting-bug',
    ],
    programmaticTools: ['diff-checker', 'regex-tester', 'text-case-converter'],
    linkCount: 20,
    placement: ['markdown-body', 'explore-related', 'sidebar', 'footer'],
    priorityAudiences: ['backend-engineer', 'devops-engineer', 'tech-lead', 'site-reliability-engineer'],
    priorityTasks: ['review-config-change', 'resolve-merge-conflict', 'debug-production-issue', 'migrate-legacy-system'],
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup Helpers
// ---------------------------------------------------------------------------

/**
 * Get the cluster mapping for a specific guide.
 */
export function getMappingForGuide(guideSlug: string): ClusterMapping | undefined {
  return CLUSTER_MAPPINGS.find(m => m.guideSlug === guideSlug);
}

/**
 * Get all guides that map to a specific programmatic cluster.
 */
export function getGuidesForCluster(clusterKey: string): ClusterMapping[] {
  return CLUSTER_MAPPINGS.filter(m => m.programmaticClusters.includes(clusterKey));
}

/**
 * Get all guides that map to a specific programmatic intent.
 */
export function getGuidesForIntent(intent: string): ClusterMapping[] {
  return CLUSTER_MAPPINGS.filter(m => m.mappedIntents.includes(intent));
}

/**
 * Get all guides that reference a specific programmatic tool.
 */
export function getGuidesForTool(toolSlug: string): ClusterMapping[] {
  return CLUSTER_MAPPINGS.filter(m => m.programmaticTools.includes(toolSlug));
}

// ---------------------------------------------------------------------------
// Slug Resolution — builds actual /k/ slugs for guide outbound links
// ---------------------------------------------------------------------------

/**
 * Simple deterministic hash for slug generation (same as in programmatic.ts).
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Build deterministic /k/ slugs for a guide's outbound links.
 * Uses the mapping table to find relevant programmatic pages.
 *
 * @param guideSlug - The guide to generate links for
 * @param maxLinks - Maximum number of links (defaults to mapping's linkCount)
 * @returns Array of { slug, intent, tool, audience, task } for link rendering
 */
export function buildGuideOutboundSlugs(
  guideSlug: string,
  maxLinks?: number,
): Array<{ slug: string; href: string; label: string }> {
  const mapping = getMappingForGuide(guideSlug);
  if (!mapping) return [];

  const limit = maxLinks ?? mapping.linkCount;
  const results: Array<{ slug: string; href: string; label: string }> = [];
  const seen = new Set<string>();

  // Deterministic iteration through intent × tool × audience × task combinations
  const intents = mapping.mappedIntents;
  const tools = mapping.programmaticTools;
  const audiences = mapping.priorityAudiences;
  const tasks = mapping.priorityTasks;

  // Use guide slug as seed for consistent selection
  const seed = simpleHash(guideSlug);
  let counter = 0;

  for (const intent of intents) {
    if (results.length >= limit) break;
    for (const tool of tools) {
      if (results.length >= limit) break;
      // Select audience and task deterministically based on seed + counter
      const audienceIdx = (seed + counter) % audiences.length;
      const taskIdx = (seed + counter * 7) % tasks.length;
      const audience = audiences[audienceIdx];
      const task = tasks[taskIdx];

      // Build the slug in the same format as programmatic.ts
      const cluster = mapping.programmaticClusters[0];
      const slug = `${cluster}-${intent}-${audience}-${task}-${tool}-${counter % 162}`;
      counter++;

      if (seen.has(slug)) continue;
      seen.add(slug);

      // Build a human-readable label
      const label = `${intent.replace(/-/g, ' ')} for ${audience.replace(/-/g, ' ')}`;

      results.push({
        slug,
        href: `/k/${slug}`,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
  }

  return results.slice(0, limit);
}

/**
 * Get the guide backlink info for a /k/ page based on its cluster and intent.
 * Returns the most relevant guide for this programmatic page.
 */
export function getGuideBacklinkForPage(
  clusterKey: string,
  intent: string,
  toolSlug: string,
): { guideSlug: string; guideTitle: string; href: string } | null {
  // First try to match by intent
  const byIntent = getGuidesForIntent(intent);
  if (byIntent.length > 0) {
    const guide = byIntent[0];
    return {
      guideSlug: guide.guideSlug,
      guideTitle: guide.guideSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      href: `/guides/${guide.guideSlug}`,
    };
  }

  // Fall back to cluster match
  const byCluster = getGuidesForCluster(clusterKey);
  if (byCluster.length > 0) {
    const guide = byCluster[0];
    return {
      guideSlug: guide.guideSlug,
      guideTitle: guide.guideSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      href: `/guides/${guide.guideSlug}`,
    };
  }

  // Fall back to tool match
  const byTool = getGuidesForTool(toolSlug);
  if (byTool.length > 0) {
    const guide = byTool[0];
    return {
      guideSlug: guide.guideSlug,
      guideTitle: guide.guideSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      href: `/guides/${guide.guideSlug}`,
    };
  }

  return null;
}
