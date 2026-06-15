/**
 * Shared types for the Google Places (New) integration.
 * These describe the *normalised* shapes our API routes return to the
 * client — not the raw Google response shapes.
 */

/** A single autocomplete suggestion returned by /api/places/autocomplete. */
export interface AutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

/** Full destination detail returned by /api/places/details/[placeId]. */
export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  summary: string | null;
  types: string[];
}

/** Standard error envelope returned by every places API route on failure. */
export interface PlacesApiError {
  error: string;
  /** Machine-readable code so the client can branch on cause. */
  code:
    | "MISSING_API_KEY"
    | "INVALID_REQUEST"
    | "UPSTREAM_ERROR"
    | "NOT_FOUND"
    | "NETWORK_ERROR"
    | "UNKNOWN";
}

/** Type guard for narrowing an unknown JSON payload to PlacesApiError. */
export function isPlacesApiError(value: unknown): value is PlacesApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "code" in value
  );
}
