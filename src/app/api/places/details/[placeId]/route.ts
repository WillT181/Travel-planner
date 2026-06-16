import { NextResponse } from "next/server";
import type { PlaceDetails, PlacesApiError } from "@/types/places";
import { getLocalDetails, isLocalPlaceId } from "@/lib/destinations/local";

const DETAILS_BASE = "https://places.googleapis.com/v1/places";

/** Width (px) requested for the hero photo via the Place Photo endpoint. */
const PHOTO_MAX_WIDTH = 1200;

interface GoogleLocalizedText {
  text?: string;
}

interface GooglePhoto {
  name?: string;
}

interface GoogleLatLng {
  latitude?: number;
  longitude?: number;
}

interface GooglePlaceDetailsResponse {
  id?: string;
  displayName?: GoogleLocalizedText;
  formattedAddress?: string;
  location?: GoogleLatLng;
  photos?: GooglePhoto[];
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: GoogleLocalizedText;
  types?: string[];
}

function errorResponse(
  body: PlacesApiError,
  status: number
): NextResponse<PlacesApiError> {
  return NextResponse.json(body, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: { placeId: string } }
): Promise<NextResponse<PlaceDetails | PlacesApiError>> {
  const placeId = params.placeId?.trim();
  if (!placeId) {
    return errorResponse(
      { error: "A placeId is required.", code: "INVALID_REQUEST" },
      400
    );
  }

  // Local dataset placeIds (from the no-key autocomplete fallback) resolve
  // entirely offline.
  if (isLocalPlaceId(placeId)) {
    const local = getLocalDetails(placeId);
    if (local) return NextResponse.json(local);
    return errorResponse(
      { error: "That destination could not be found.", code: "NOT_FOUND" },
      404
    );
  }

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

  let upstream: Response;
  try {
    upstream = await fetch(`${DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,photos,rating,userRatingCount,editorialSummary,types",
      },
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

  if (upstream.status === 404) {
    return errorResponse(
      { error: "That destination could not be found.", code: "NOT_FOUND" },
      404
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

  const data: GooglePlaceDetailsResponse = await upstream.json();

  // The Place Photo endpoint takes the photo resource name and returns media.
  const firstPhoto = data.photos?.[0]?.name;
  const photoUrl = firstPhoto
    ? `${DETAILS_BASE.replace("/places", "")}/${firstPhoto}/media?maxWidthPx=${PHOTO_MAX_WIDTH}&key=${apiKey}`
    : null;

  const details: PlaceDetails = {
    id: data.id ?? placeId,
    name: data.displayName?.text ?? "Unknown place",
    address: data.formattedAddress ?? "",
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
    photoUrl,
    rating: data.rating ?? null,
    reviewCount: data.userRatingCount ?? null,
    summary: data.editorialSummary?.text ?? null,
    types: data.types ?? [],
  };

  return NextResponse.json(details);
}
