import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cityResult, searchLocalCities } from "@/lib/destinations/local";
import type { CitySearchResult } from "@/types/places";

/**
 * City autocomplete, backed by the public.cities table (seeded from
 * cities.full.json — see scripts/seed-cities.mjs). Country name + flag are
 * joined in from the bundled countries.json so the client gets ready-to-render
 * rows. Degrades to the in-memory dataset when the database is unavailable.
 *
 *   GET /api/cities/search?q=lisb  →  CitySearchResult[]
 */

const LIMIT = 10;

export async function GET(
  request: Request
): Promise<NextResponse<CitySearchResult[]>> {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([]);

  // No Supabase configured → serve from the bundled dataset.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json(searchLocalCities(q, LIMIT));
  }

  try {
    const supabase = createClient();
    // Trigram GIN index on lower(name) makes this %contains% search fast.
    const { data, error } = await supabase
      .from("cities")
      .select("name, country_id")
      .ilike("name", `%${q}%`)
      .limit(LIMIT);

    if (error || !data) {
      return NextResponse.json(searchLocalCities(q, LIMIT));
    }

    const results = data
      .map((row) => cityResult(row.name, row.country_id))
      .filter((c): c is CitySearchResult => c !== null);

    return NextResponse.json(results);
  } catch {
    // Network/config blip — fall back to the local dataset.
    return NextResponse.json(searchLocalCities(q, LIMIT));
  }
}
