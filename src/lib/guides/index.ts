import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface QuickFacts {
  capital: string;
  currency: string;
  language: string;
  bestMonths: string;
  budgetPerDay: number | null;
  visaSummary: string;
}

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  country: string;
  heroImage: string;
  lastUpdated: string;
  quickFacts: QuickFacts;
}

export interface Guide extends GuideMeta {
  content: string;
}

const GUIDES_DIR = path.join(process.cwd(), "src/content/guides");

function parseGuideFile(file: string): GuideMeta {
  const raw = fs.readFileSync(path.join(GUIDES_DIR, file), "utf8");
  const { data } = matter(raw);
  const slug = path.basename(file, ".mdx");
  const qf = (data.quickFacts ?? {}) as Partial<QuickFacts>;
  return {
    slug: data.slug ?? slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    country: data.country ?? "",
    heroImage: data.heroImage ?? "",
    lastUpdated: data.lastUpdated ?? "",
    quickFacts: {
      capital: qf.capital ?? "",
      currency: qf.currency ?? "",
      language: qf.language ?? "",
      bestMonths: qf.bestMonths ?? "",
      budgetPerDay: qf.budgetPerDay ?? null,
      visaSummary: qf.visaSummary ?? "",
    },
  };
}

export function getAllGuides(): GuideMeta[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map(parseGuideFile)
    .sort((a, b) => a.country.localeCompare(b.country));
}

export function getGuide(slug: string): Guide | null {
  const file = path.join(GUIDES_DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  const qf = (data.quickFacts ?? {}) as Partial<QuickFacts>;
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    country: data.country ?? "",
    heroImage: data.heroImage ?? "",
    lastUpdated: data.lastUpdated ?? "",
    quickFacts: {
      capital: qf.capital ?? "",
      currency: qf.currency ?? "",
      language: qf.language ?? "",
      bestMonths: qf.bestMonths ?? "",
      budgetPerDay: qf.budgetPerDay ?? null,
      visaSummary: qf.visaSummary ?? "",
    },
    content,
  };
}

/** Extract h2 headings from raw MDX content for the ToC. */
export function extractHeadings(
  content: string
): { id: string; text: string }[] {
  const matches = Array.from(content.matchAll(/^## (.+)$/gm));
  return matches.map((m) => {
    const text = m[1].trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return { id, text };
  });
}

/** Return up to `count` guides from the same region, excluding `currentSlug`. */
export function getNearbyGuides(currentSlug: string, count = 4): GuideMeta[] {
  // Load top50 + countries to get region info
  const top50Path = path.join(process.cwd(), "scripts/guides/top50.json");
  const countriesPath = path.join(
    process.cwd(),
    "src/data/destinations/countries.json"
  );

  if (!fs.existsSync(top50Path) || !fs.existsSync(countriesPath)) return [];

  const top50 = JSON.parse(fs.readFileSync(top50Path, "utf8")) as {
    id: string;
    slug: string;
    name: string;
  }[];
  const countries = JSON.parse(fs.readFileSync(countriesPath, "utf8")) as {
    id: string;
    region: string;
    subregion: string;
  }[];
  const byId = Object.fromEntries(countries.map((c) => [c.id, c]));

  const current = top50.find((e) => e.slug === currentSlug);
  if (!current) return [];

  const currentCountry = byId[current.id];
  if (!currentCountry) return [];

  const region = currentCountry.region;
  const guides = getAllGuides();
  const bySlug = Object.fromEntries(guides.map((g) => [g.slug, g]));

  return top50
    .filter((e) => {
      if (e.slug === currentSlug) return false;
      const c = byId[e.id];
      return c?.region === region && bySlug[e.slug];
    })
    .slice(0, count)
    .map((e) => bySlug[e.slug]);
}
