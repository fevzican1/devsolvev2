import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { guideRegistry } from "@/content/guides";
import { toolRegistry } from "@/tools/registry";

// Self-canonical metadata. Previously this page exported a bare
// `{ title }` object, so it inherited the root layout's default
// `canonical: '/'` and reported `https://devsolvev2.com` as its canonical —
// exactly the "Duplicate, Google chose different canonical" / "Alternate page"
// signal we are trying to eliminate. buildMetadata pins a correct
// self-referencing canonical at /fix.
export const metadata: Metadata = buildMetadata({
  title: "Error Fixes & Debugging Guides",
  description:
    "Browse DevSolve's debugging and error-fix resources: in-depth guides plus browser-based developer tools for diagnosing and resolving real-world JSON, encoding, token, regex, and formatting problems.",
  path: "/fix",
  keywords: [
    "error fixes",
    "debugging guides",
    "developer troubleshooting",
    "fix json errors",
    "fix encoding bugs",
  ],
});

const DEBUG_TOOL_SLUGS = [
  "json-formatter",
  "diff-checker",
  "regex-tester",
  "jwt-decoder",
  "base64-encode-decode",
  "url-encode-decode",
];

export default function FixIndexPage() {
  const debugTools = toolRegistry.filter((tool) =>
    DEBUG_TOOL_SLUGS.includes(tool.slug),
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Error Fixes &amp; Debugging Guides</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        When a build breaks, a payload fails to parse, or a token will not
        validate, the fastest path to a fix is to reproduce the exact failure
        against a small, frozen sample. The guides and browser-based tools below
        help you isolate the root cause and verify the fix locally — no data
        ever leaves your browser.
      </p>

      <section aria-labelledby="fix-guides" className="mb-10">
        <h2 id="fix-guides" className="text-2xl font-semibold mb-4">
          Troubleshooting guides
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {guideRegistry.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {guide.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {guide.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fix-tools" className="mb-10">
        <h2 id="fix-tools" className="text-2xl font-semibold mb-4">
          Diagnostic tools
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {debugTools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {tool.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {tool.shortDescription}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-muted-foreground">
        Looking for a specific scenario? Explore the full{" "}
        <Link href="/k" className="text-blue-600 hover:underline">
          library of task-specific solutions
        </Link>{" "}
        or browse all{" "}
        <Link href="/tools" className="text-blue-600 hover:underline">
          developer tools
        </Link>
        .
      </p>
    </div>
  );
}
