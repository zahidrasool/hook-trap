import type { MetadataRoute } from "next";

// Single source of truth for the host, so a preview deployment cannot emit a
// sitemap that points at production.
const BASE_URL = "https://mocklane.com";

// Only public marketing and docs pages belong here. /dashboard, /admin and
// /auth are excluded deliberately: they are per-user app surfaces, and they
// carry an X-Robots-Tag: noindex from middleware.ts rather than a robots.txt
// Disallow — see the comment there for why.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/why`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
