// src/app/fix/page.tsx
import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Error fixes — DevSolve",
  description:
    "Browse curated fixes and step-by-step guides for common runtime and build errors across libraries and versions. Find verified code snippets and reproduction steps.",
  openGraph: {
    title: "Error fixes — DevSolve",
    description:
      "Browse curated fixes and step-by-step guides for common runtime and build errors across libraries and versions. Find verified code snippets and reproduction steps.",
    url: "https://devsolvev2.com/fix/",
  },
};

const exampleLinks = [
  { href: "/k/api-normalize-api-data-tech-lead-resolve-merge-conflict-url-encode-decode-10416798", label: "Normalize API data — example" },
  { href: "/k/json-format-json-data-engineer-migrate-legacy-system-json-to-typescript-698841", label: "JSON formatting examples" },
  { href: "/k/web-protect-against-xss-devops-engineer-prepare-query-parameters-css-minifier-17022337", label: "Protect against XSS" },
];

export default function FixIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    name: "Error fixes",
    url: "https://devsolvev2.com/fix/",
    about: "Curated list of fixes and guidance for common development errors.",
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-3xl font-bold mb-4">Error fixes</h1>

      <p className="text-muted-foreground mb-6">
        This section collects verified fixes and practical guidance to resolve common runtime and build errors across
        libraries and versions. Each page aims to include reproduction steps, cause analysis, and at least one working code snippet
        where possible.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Quick links</h2>
        <ul className="list-disc pl-5">
          {exampleLinks.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-blue-600 underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">How to use these guides</h2>
        <ol className="list-decimal pl-5">
          <li>Check reproduction steps and minimal environment required.</li>
          <li>Try the verified snippet in a safe environment (local / sandbox).</li>
          <li>If it resolves, follow the mitigation steps for your version.</li>
        </ol>
      </section>
    </div>
  );
}
