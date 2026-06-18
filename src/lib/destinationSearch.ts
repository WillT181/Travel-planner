import countriesData from "@/data/destinations/countries.json";
import citiesData from "@/data/destinations/cities.major.json";

export interface IndexEntry {
  type: "country" | "city";
  name: string;
  nameLower: string;
  slug: string;
  flag: string;
  secondary: string;
  isCapital: boolean;
}

export interface SearchResult {
  results: IndexEntry[];
  totalMatches: number;
}

// Cached at module level — computed once on first call.
let _index: IndexEntry[] | null = null;

export function buildIndex(): IndexEntry[] {
  if (_index) return _index;

  const flagById = new Map<string, string>(
    countriesData.map((c) => [c.id, c.flag])
  );

  const entries: IndexEntry[] = [];

  for (const c of countriesData) {
    entries.push({
      type: "country",
      name: c.name,
      nameLower: c.name.toLowerCase(),
      slug: c.slug,
      flag: c.flag,
      secondary: `Country · ${c.region}`,
      isCapital: false,
    });
  }

  for (const city of citiesData) {
    entries.push({
      type: "city",
      name: city.name,
      nameLower: city.name.toLowerCase(),
      slug: city.slug,
      flag: flagById.get(city.countryId) ?? "",
      secondary: `City · ${city.country}`,
      isCapital: city.isCapital,
    });
  }

  _index = entries;
  return _index;
}

// Ranking tiers (lower = better):
//   0  exact name match
//   1  prefix match, non-capital (includes all countries + non-capital cities)
//   2  prefix match, capital city
//   3  contains match anywhere in name
function tier(entry: IndexEntry, q: string): number | null {
  const n = entry.nameLower;
  if (n === q) return 0;
  if (n.startsWith(q)) return entry.isCapital ? 2 : 1;
  if (n.includes(q)) return 3;
  return null;
}

function compareEntries(
  a: { entry: IndexEntry; tier: number },
  b: { entry: IndexEntry; tier: number }
): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  // Within same tier: countries before cities, then alphabetical.
  if (a.entry.type !== b.entry.type) {
    return a.entry.type === "country" ? -1 : 1;
  }
  return a.entry.name.localeCompare(b.entry.name);
}

export function searchDestinations(query: string, limit = 8): SearchResult {
  if (!query.trim()) return { results: [], totalMatches: 0 };

  const q = query.toLowerCase();
  const matched: Array<{ entry: IndexEntry; tier: number }> = [];

  for (const entry of buildIndex()) {
    const t = tier(entry, q);
    if (t !== null) matched.push({ entry, tier: t });
  }

  matched.sort(compareEntries);

  return {
    results: matched.slice(0, limit).map((m) => m.entry),
    totalMatches: matched.length,
  };
}
