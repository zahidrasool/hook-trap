import type { Metadata } from "next";

// docs/page.tsx is a client component (it owns the TOC scroll state), so it
// cannot export `metadata` itself. This layout carries it instead.
export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to capture webhooks, build mock API endpoints with dynamic templated responses, import an OpenAPI spec, and receive test email over SMTP with MockLane.",
  alternates: { canonical: "/docs" },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
