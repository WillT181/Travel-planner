import type { MetadataRoute } from "next";
import { DESTINATIONS } from "@/data/destinations";
import { COUNTRIES, MAJOR_CITIES } from "@/lib/destinations/catalog";
import { getAllPosts } from "@/lib/blog/posts";
import { getAllGuides } from "@/lib/guides";

const BASE_URL = "https://wanderly.travel";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/inspiration`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  const destinationRoutes: MetadataRoute.Sitemap = DESTINATIONS.map((d) => ({
    url: `${BASE_URL}/explore/${d.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // Every /explore destination page: all countries + capital cities from the
  // generated catalog (seed guides above take the higher priority). Non-capital
  // major cities are excluded to keep the sitemap focused on strong pages.
  const seedSlugs = new Set(DESTINATIONS.map((d) => d.slug));
  const countryRoutes: MetadataRoute.Sitemap = COUNTRIES.filter(
    (c) => !seedSlugs.has(c.slug)
  ).map((c) => ({
    url: `${BASE_URL}/explore/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  const capitalRoutes: MetadataRoute.Sitemap = MAJOR_CITIES.filter(
    (c) => c.isCapital && !seedSlugs.has(c.slug)
  ).map((c) => ({
    url: `${BASE_URL}/explore/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.55,
  }));

  const posts = getAllPosts();
  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const guides = getAllGuides();
  const guideIndexRoute: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/guides`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
  const guideRoutes: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${BASE_URL}/guides/${g.slug}`,
    lastModified: g.lastUpdated ? new Date(g.lastUpdated) : now,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  return [
    ...staticRoutes,
    ...destinationRoutes,
    ...countryRoutes,
    ...capitalRoutes,
    ...blogRoutes,
    ...guideIndexRoute,
    ...guideRoutes,
  ];
}
