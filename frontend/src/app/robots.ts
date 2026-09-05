import type { MetadataRoute } from "next";

const BASE_URL = "https://mocklane.com";

// Why the app surfaces are NOT disallowed here:
//
// /dashboard, /admin and /auth are linked from the public header, so crawlers
// will find them no matter what this file says. A `Disallow` only stops the
// fetch — it does not remove a URL from the index, and a blocked URL can still
// rank as a bare link. To actually keep them out, the crawler has to fetch the
// page and read `X-Robots-Tag: noindex`, which middleware.ts sets. Blocking
// here would hide that header and keep the URLs indexed, which is the opposite
// of what we want.
//
// AI crawlers are listed explicitly even though `*` already allows them. The
// entries are documentation of intent: this is a developer tool that benefits
// from being citable in ChatGPT, Claude, Perplexity and AI Overviews, so a
// future blanket tightening should have to remove these lines deliberately
// rather than cut off AI traffic as a side effect.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "CCBot", allow: "/" },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
