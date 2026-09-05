import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { JsonLd, ORG_ID, SITE_URL } from "@/components/seo/JsonLd";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
        {/* Site-wide publisher identity. `sameAs` is deliberately absent:
            there are no verified social profiles to point at, and inventing
            them would be worse than omitting the property. */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": ORG_ID,
            name: "MockLane",
            url: SITE_URL,
            logo: `${SITE_URL}/logo.png`,
            description:
              "MockLane is a developer platform for webhook capture, mock API creation and email sandbox testing.",
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
