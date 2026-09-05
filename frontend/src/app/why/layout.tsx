import type { Metadata } from "next";

// why/page.tsx is a client component, so metadata lives here.
export const metadata: Metadata = {
  // Absolute: the page name already carries the brand, so the root layout's
  // "%s | MockLane" template would render "Why MockLane | MockLane".
  title: { absolute: "Why MockLane — Webhooks, Mock APIs and Email in One Tool" },
  description:
    "Why use MockLane: webhook capture, mock APIs and a fake SMTP inbox in one tool, instead of stitching together three separate services.",
  alternates: { canonical: "/why" },
};

export default function WhyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
