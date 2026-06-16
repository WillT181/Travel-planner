import { NextResponse } from "next/server";
import type { AutocompleteResult, PlacesApiError } from "@/types/places";
import { searchLocalDestinations } from "@/lib/destinations/local";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

interface GoogleStructuredFormat {
  mainText?: { text?: string };
  secondaryText?: { text?: string };
}

interface GooglePlacePrediction {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: GoogleStructuredFormat;
}

interface GoogleAutocompleteResponse {
  suggestions?: { placePrediction?: GooglePlacePrediction }[];
}

function errorResponse(
  body: PlacesApiError,
  status: number
): NextResponse<PlacesApiError> {
  return NextResponse.json(body, { status });
}

function hasGoogleKey(apiKey: string | undefined): apiKey is string {
  return Boolean(apiKey) && apiKey !== "YOUR_GOOGLE_PLACES_API_KEY_HERE";
}

export async function POST(
  request: Request
): Promise<NextResponse<AutocompleteResult[] | PlacesApiError>> {
  let input: unknown;
  try {
    const body = await request.json();
    input = body?.input;
  } catch {
    return errorResponse(
      { error: "Request body must be valid JSON.", code: "INVALID_REQUEST" },
      400
    );
  }

  if (typeof input !== "string" || input.trim().length === 0) {
    return errorResponse(
      {
        error: "A non-empty 'input' string is required.",
        code: "INVALID_REQUEST",
      },
      400
    );
  }

  const query = input.trim();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  // No Google key configured → serve from the bundled local dataset so search
  // still works out of the box.
  if (!hasGoogleKey(apiKey)) {
    return NextResponse.json(searchLocalDestinations(query));
  }

  let upstream: Response;
  try {
    upstream = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({ input: query }),
      cache: "no-store",
    });
  } catch {
    // Network blip reaching Google — degrade to the local dataset.
    return NextResponse.json(searchLocalDestinations(query));
  }

  if (!upstream.ok) {
    // Bad/unauthorised key or upstream error — degrade to the local dataset
    // rather than failing the whole search.
    return NextResponse.json(searchLocalDestinations(query));
  }

  const data: GoogleAutocompleteResponse = await upstream.json();

  const results: AutocompleteResult[] = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is GooglePlacePrediction => Boolean(p?.placeId))
    .map((p) => ({
      placeId: p.placeId as string,
      description: p.text?.text ?? "",
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
    }));

  return NextResponse.json(results);
}
