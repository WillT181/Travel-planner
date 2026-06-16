/**
 * Local destination search — powered by the dataset generated with
 * `npm run generate:destinations` (see scripts/generate-destinations.mjs).
 *
 * This is the offline/no-key fallback for the Places search feature: when the
 * Google Places API key is absent (or the upstream call fails), the
 * /api/places/* routes serve suggestions and details from this bundled dataset
 * instead. It covers 248 countries and every city in the source dataset
 * (~156k), so search works fully out of the box without any third-party key.
 *
 * The data files live in src/data/destinations/ and are imported server-side
 * only — they are never shipped in the client bundle. The search index is
 * built once at module load and reused across requests.
 */

import countriesData from "@/data/destinations/countries.json";
import citiesData from "@/data/destinations/cities.full.json";
import type { AutocompleteResult, PlaceDetails } from "@/types/places";

export interface CountryRow {
  id: string;
  name: string;
  slug: string;
  capital: string | null;
  region: string;
  subregion: string | null;
  currency: string | null;
  currencySymbol: string | null;
  flag: string | null;
  lat: number | null;
  lng: number | null;
  cityCount: number;
}

/** Minimal row shape in cities.full.json. */
interface RawCity {
  name: string;
  countryId: string;
}

const countries = countriesData as CountryRow[];
const rawCities = citiesData as RawCity[];

const CITY_PREFIX = "local:city:";
const COUNTRY_PREFIX = "local:country:";

/** Lowercase + strip accents so "sao paulo" matches "São Paulo". */
function normalise(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** URL-safe slug matching the generator's slugify(). */
function slugify(value: string): string {
  return normalise(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const countryById = new Map(countries.map((c) => [c.id, c]));

/** Precomputed, searchable city index (built once at cold start). */
interface CityIndexEntry {
  name: string;
  norm: string;
  countryId: string;
  country: string;
  isCapital: boolean;
  placeId: string;
}

const cityIndex: CityIndexEntry[] = [];
/** placeId → entry, for O(1) details resolution. */
const cityByPlaceId = new Map<string, CityIndexEntry>();

for (const raw of rawCities) {
  const country = countryById.get(raw.countryId);
  if (!country) continue;
  const placeId = `${CITY_PREFIX}${raw.countryId}:${slugify(raw.name)}`;
  // Skip duplicate (country, slug) pairs — first occurrence wins.
  if (cityByPlaceId.has(placeId)) continue;
  const entry: CityIndexEntry = {
    name: raw.name,
    norm: normalise(raw.name),
    countryId: raw.countryId,
    country: country.name,
    isCapital:
      country.capital != null &&
      normalise(country.capital) === normalise(raw.name),
    placeId,
  };
  cityIndex.push(entry);
  cityByPlaceId.set(placeId, entry);
}

const countryIndex = countries.map((c) => ({
  country: c,
  norm: normalise(c.name),
}));

/**
 * Relevance score for a candidate name against the normalised query — lower is
 * better, Infinity means "no match". Exact > prefix > word-start > substring.
 */
function matchScore(norm: string, query: string): number {
  if (norm === query) return 0;
  if (norm.startsWith(query)) return 1;
  if (norm.split(/[\s\-/]+/).some((word) => word.startsWith(query))) return 2;
  const idx = norm.indexOf(query);
  if (idx >= 0) return 3 + idx / 1000;
  return Infinity;
}

interface ScoredResult {
  result: AutocompleteResult;
  score: number;
  rank: number;
}

/**
 * Search countries + cities for an autocomplete query. Returns at most `limit`
 * suggestions ordered by relevance (capitals and larger countries rank first
 * on ties).
 */
export function searchLocalDestinations(
  input: string,
  limit = 8
): AutocompleteResult[] {
  const query = normalise(input.trim());
  if (!query) return [];

  const scored: ScoredResult[] = [];

  for (const { country, norm } of countryIndex) {
    const score = matchScore(norm, query);
    if (score === Infinity) continue;
    scored.push({
      score,
      rank: -country.cityCount,
      result: {
        placeId: `${COUNTRY_PREFIX}${country.id}`,
        description: `${country.flag ? country.flag + " " : ""}${country.name}`,
        mainText: country.name,
        secondaryText: country.region,
      },
    });
  }

  for (const entry of cityIndex) {
    const score = matchScore(entry.norm, query);
    if (score === Infinity) continue;
    scored.push({
      // Gently prefer a country, then capitals, over ordinary like-named cities.
      score: score + 0.5,
      rank: entry.isCapital ? 0 : 1,
      result: {
        placeId: entry.placeId,
        description: `${entry.name}, ${entry.country}`,
        mainText: entry.name,
        secondaryText: entry.country,
      },
    });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.rank - b.rank ||
      a.result.mainText.length - b.result.mainText.length ||
      a.result.mainText.localeCompare(b.result.mainText)
  );

  return scored.slice(0, limit).map((s) => s.result);
}

/** True for placeIds produced by this module. */
export function isLocalPlaceId(placeId: string): boolean {
  return placeId.startsWith("local:");
}

/** Deterministic placeholder image so each destination card has a photo. */
function photoFor(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/675`;
}

function cityDetails(entry: CityIndexEntry): PlaceDetails {
  const country = countryById.get(entry.countryId);
  const role = entry.isCapital ? "the capital city" : "a city";
  const currency = country?.currency
    ? ` The local currency is the ${country.currency}${
        country.currencySymbol ? ` (${country.currencySymbol})` : ""
      }.`
    : "";

  return {
    id: entry.placeId,
    name: entry.name,
    address: `${entry.name}, ${entry.country}`,
    lat: country?.lat ?? null,
    lng: country?.lng ?? null,
    photoUrl: photoFor(`${entry.countryId}-${entry.name}`),
    rating: null,
    reviewCount: null,
    summary: `${entry.name} is ${role} in ${entry.country}${
      country?.subregion ? `, ${country.subregion}` : ""
    }.${currency}`,
    types: [
      entry.isCapital ? "capital_city" : "city",
      ...(country?.region
        ? [country.region.toLowerCase().replace(/\s+/g, "_")]
        : []),
    ],
  };
}

function countryDetails(country: CountryRow): PlaceDetails {
  const capital = country.capital ? ` Its capital is ${country.capital}.` : "";
  const currency = country.currency
    ? ` Currency: ${country.currency}${
        country.currencySymbol ? ` (${country.currencySymbol})` : ""
      }.`
    : "";

  return {
    id: `${COUNTRY_PREFIX}${country.id}`,
    name: `${country.flag ? country.flag + " " : ""}${country.name}`,
    address: country.subregion
      ? `${country.subregion}, ${country.region}`
      : country.region,
    lat: country.lat,
    lng: country.lng,
    photoUrl: photoFor(country.slug),
    rating: null,
    reviewCount: null,
    summary: `${country.name} is a country in ${country.region}.${capital}${currency}`,
    types: ["country", country.region.toLowerCase().replace(/\s+/g, "_")],
  };
}

/** Resolve full details for a local placeId, or null if it's unknown. */
export function getLocalDetails(placeId: string): PlaceDetails | null {
  if (placeId.startsWith(CITY_PREFIX)) {
    const entry = cityByPlaceId.get(placeId);
    return entry ? cityDetails(entry) : null;
  }
  if (placeId.startsWith(COUNTRY_PREFIX)) {
    const country = countryById.get(placeId.slice(COUNTRY_PREFIX.length));
    return country ? countryDetails(country) : null;
  }
  return null;
}
