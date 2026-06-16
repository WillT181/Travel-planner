/**
 * Generated-destination catalog — a lightweight lookup over the bundled
 * countries.json + cities.major.json datasets (NOT cities.full.json, which is
 * server-only and far too large to ship).
 *
 * Used to resolve a `/explore/{slug}` slug — produced by DestinationSearch —
 * into a renderable destination, and by createTrip so any searched place can
 * start a trip. Seed destinations (src/data/destinations.ts) take precedence;
 * this fills in the long tail of countries and major cities.
 *
 * Safe to import from both client and server code.
 */

import countriesRaw from "@/data/destinations/countries.json";
import citiesRaw from "@/data/destinations/cities.major.json";

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

export interface CityRow {
  name: string;
  countryId: string;
  country: string;
  /** "<country-slug>/<city-slug>" — globally unique within the dataset. */
  slug: string;
  isCapital: boolean;
}

export const COUNTRIES = countriesRaw as CountryRow[];
export const MAJOR_CITIES = citiesRaw as CityRow[];

/** A resolved place, whether a whole country or a single city. */
export interface CatalogDestination {
  kind: "country" | "city";
  slug: string;
  /** Display name — the city name, or the country name. */
  name: string;
  country: string;
  countryId: string;
  region: string;
  subregion: string | null;
  capital: string | null;
  currency: string | null;
  currencySymbol: string | null;
  flag: string | null;
  isCapital: boolean;
  lat: number | null;
  lng: number | null;
}

const countryBySlug = new Map(COUNTRIES.map((c) => [c.slug, c]));
const countryById = new Map(COUNTRIES.map((c) => [c.id, c]));
const cityBySlug = new Map(MAJOR_CITIES.map((c) => [c.slug, c]));

function fromCountry(c: CountryRow): CatalogDestination {
  return {
    kind: "country",
    slug: c.slug,
    name: c.name,
    country: c.name,
    countryId: c.id,
    region: c.region,
    subregion: c.subregion,
    capital: c.capital,
    currency: c.currency,
    currencySymbol: c.currencySymbol,
    flag: c.flag,
    isCapital: false,
    lat: c.lat,
    lng: c.lng,
  };
}

function fromCity(city: CityRow): CatalogDestination {
  const country = countryById.get(city.countryId);
  return {
    kind: "city",
    slug: city.slug,
    name: city.name,
    country: city.country,
    countryId: city.countryId,
    region: country?.region ?? "",
    subregion: country?.subregion ?? null,
    capital: country?.capital ?? null,
    currency: country?.currency ?? null,
    currencySymbol: country?.currencySymbol ?? null,
    flag: country?.flag ?? null,
    isCapital: city.isCapital,
    lat: country?.lat ?? null,
    lng: country?.lng ?? null,
  };
}

/**
 * Resolve a slug (e.g. "portugal" or "portugal/lisbon") to a catalog
 * destination, or null if it isn't a known country or major city.
 */
export function resolveCatalogDestination(
  slug: string
): CatalogDestination | null {
  const clean = slug.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!clean) return null;

  if (clean.includes("/")) {
    const city = cityBySlug.get(clean);
    return city ? fromCity(city) : null;
  }

  const country = countryBySlug.get(clean);
  return country ? fromCountry(country) : null;
}
