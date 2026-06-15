import type { MetadataRoute } from "next";

const BASE_URL = "https://wanderly.travel";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/trip", "/account", "/onboarding", "/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
