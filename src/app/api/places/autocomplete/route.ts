import { NextResponse } from "next/server";
import type { AutocompleteResult, PlacesApiError } from "@/types/places";

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

export async function POST(
  request: Request
): Promise<NextResponse<AutocompleteResult[] | PlacesApiError>> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!apiKey || apiKey === "YOUR_GOOGLE_PLACES_API_KEY_HERE") {
    return errorResponse(
      {
        error:
          "Google Places API key is not configured. Add NEXT_PUBLIC_GOOGLE_PLACES_API_KEY to .env.local.",
        code: "MISSING_API_KEY",
      },
      500
    );
  }

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
      body: JSON.stringify({ input: input.trim() }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(
      {
        error: "Could not reach the Places service. Check your connection.",
        code: "NETWORK_ERROR",
      },
      503
    );
  }

  if (!upstream.ok) {
    const status = upstream.status === 403 ? 401 : 502;
    return errorResponse(
      {
        error:
          upstream.status === 403
            ? "The Places API rejected the request — the API key may be invalid or unauthorised."
            : "The Places service returned an unexpected error.",
        code: upstream.status === 403 ? "MISSING_API_KEY" : "UPSTREAM_ERROR",
      },
      status
    );
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
