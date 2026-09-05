import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// The canonical origin. Every relative URL below — canonicals, OG images —
// resolves against this, so it must be absolute and must be the apex domain
// (www redirects to it at the Caddy layer).
const SITE_URL = "https://mocklane.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pages set only their own `title`; the template appends the brand. A page
  // that sets nothing falls back to `default`.
  title: {
    default: "MockLane — Webhook Testing, Mock APIs & Email Sandboxes",
    template: "%s | MockLane",
  },
  description:
    "Capture and replay webhooks, stand up mock APIs with dynamic responses, and catch test email in a sandbox inbox. Free plan, no credit card.",
  applicationName: "MockLane",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "MockLane",
    url: SITE_URL,
    title: "MockLane — Webhook Testing, Mock APIs & Email Sandboxes",
    description:
      "Capture and replay webhooks, stand up mock APIs with dynamic responses, and catch test email in a sandbox inbox.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MockLane — Webhook Testing, Mock APIs & Email Sandboxes",
    description:
      "Capture and replay webhooks, stand up mock APIs with dynamic responses, and catch test email in a sandbox inbox.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d)}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
