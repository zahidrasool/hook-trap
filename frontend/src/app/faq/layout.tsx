import type { Metadata } from "next";

// faq/page.tsx is a client component (accordion state), so metadata lives here.
export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about MockLane: how webhook capture works, what mock endpoints can do, how sandbox inboxes receive email, and what each plan includes.",
  alternates: { canonical: "/faq" },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
