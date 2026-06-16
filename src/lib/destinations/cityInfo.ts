/**
 * City enrichment via the Open-Meteo geocoding API (free, no key). Given a city
 * name + country code, returns coordinates and facts (population, admin region,
 * timezone, elevation) used to flesh out the /explore/{city} page.
 *
 * Best-effort: any failure returns null and the page degrades gracefully.
 * Results are cached for a day — city facts don't change and this keeps us well
 * within Open-Meteo's free limits.
 */

export interface CityInfo {
  latitude: number;
  longitude: number;
  /** Resident population, when the dataset has it. */
  population: number | null;
  /** First-level admin region (state / province / county). */
  region: string | null;
  /** IANA timezone, e.g. "Europe/Lisbon". */
  timezone: string | null;
  /** Metres above sea level. */
  elevation: number | null;
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  population?: number;
  admin1?: string;
  timezone?: string;
  elevation?: number;
}

/**
 * Resolve a city to its coordinates + facts. Prefers a result whose country
 * matches `countryCode` (ISO-3166 alpha-2); falls back to the first match.
 */
export async function getCityInfo(
  name: string,
  countryCode: string
): Promise<CityInfo | null> {
  try {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=" +
      encodeURIComponent(name);
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;

    const json = (await res.json()) as { results?: GeoResult[] };
    const results = json.results ?? [];
    if (results.length === 0) return null;

    const cc = countryCode.toUpperCase();
    const match =
      results.find((r) => (r.country_code ?? "").toUpperCase() === cc) ??
      results[0];

    return {
      latitude: match.latitude,
      longitude: match.longitude,
      population: match.population ?? null,
      region: match.admin1 ?? null,
      timezone: match.timezone ?? null,
      elevation: match.elevation ?? null,
    };
  } catch {
    return null;
  }
}
