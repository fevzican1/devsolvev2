import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Error fixes",
};

export default function FixIndexPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Error fixes</h1>
      <p className="text-muted-foreground mb-6">
        Browse known fixes and guides.
      </p>
      <p>
        Example link to a fix: <Link href="/fix/example-slug">example-slug</Link>
      </p>
    </div>
  );
}
