/**
 * Destination photography — lookup layer over
 * src/data/destinations/images.json (produced by
 * scripts/images/fetch-destination-images.mjs and curated at
 * /dev/image-review).
 *
 * Safe to import from server and client code (the JSON is bundled).
 * Everything degrades gracefully: no entry / no selection → null, and the
 * DestinationPhoto component renders a branded gradient fallback.
 */

import imagesData from "@/data/destinations/images.json";

export interface ImageCandidate {
  /** Unsplash photo id. */
  id: string;
  /** `urls.raw` — base URL accepting imgix params (w, q, fm, fit…). */
  rawUrl: string;
  /** `urls.full` — full-resolution JPEG. */
  fullUrl: string;
  /** `urls.regular` — ~1080px, used by the review page. */
  regularUrl: string;
  width: number;
  height: number;
  /** Dominant colour hex from Unsplash — used for the blur placeholder. */
  color: string;
  alt: string | null;
  photographer: string;
  photographerUrl: string;
  /** Unsplash photo page (for attribution links). */
  photoUrl: string;
  downloadLocation: string;
}

export interface ImageEntry {
  query: string;
  /** Hand-authored fallback alt text describing the intended scene. */
  defaultAlt?: string;
  /** Index into candidates chosen at /dev/image-review; null = unreviewed. */
  selected: number | null;
  candidates: ImageCandidate[];
}

export interface SelectedImage extends ImageCandidate {
  alt: string;
}

const IMAGES = imagesData as Record<string, ImageEntry>;

export const UNSPLASH_UTM = "?utm_source=wanderly&utm_medium=referral";

export function getImageEntry(key: string): ImageEntry | null {
  return IMAGES[key] ?? null;
}

/**
 * Resolve the curated photo for a destination, trying several keys in order
 * (e.g. ["portugal/lisbon", "lisbon", "portugal"]). Returns null when
 * nothing has been selected yet — callers render the branded fallback.
 */
export function resolveImage(
  ...keys: (string | null | undefined)[]
): SelectedImage | null {
  for (const key of keys) {
    if (!key) continue;
    const entry = IMAGES[key];
    if (!entry || entry.selected == null) continue;
    const candidate = entry.candidates[entry.selected];
    if (!candidate) continue;
    return {
      ...candidate,
      alt:
        candidate.alt?.trim() ||
        entry.defaultAlt ||
        `Travel photograph of ${key.split("/").pop()?.replace(/-/g, " ")}`,
    };
  }
  return null;
}

/** Expand a slug into lookup keys: full slug, city segment, country segment. */
export function slugKeys(slug: string): string[] {
  const parts = slug.split("/").filter(Boolean);
  const keys = [slug];
  if (parts.length > 1) {
    keys.push(parts[parts.length - 1], parts[0]);
  }
  return keys;
}

/**
 * Sized Unsplash URL from the raw base — dynamic resizing on their CDN so
 * next/image never receives more pixels than it asks for.
 */
export function unsplashSrc(image: ImageCandidate, width: number): string {
  const sep = image.rawUrl.includes("?") ? "&" : "?";
  return `${image.rawUrl}${sep}w=${width}&q=80&auto=format&fit=crop`;
}

/** 8×5 solid-colour SVG as a data URI — the blur placeholder. */
export function blurDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="5"><rect width="8" height="5" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${
    typeof btoa === "function" ? btoa(svg) : Buffer.from(svg).toString("base64")
  }`;
}

/** Photographer profile URL with the licence-required UTM params. */
export function creditUrl(photographerUrl: string): string {
  return `${photographerUrl}${UNSPLASH_UTM}`;
}

/** Deterministic brand gradient for destinations without a photo yet. */
const FALLBACK_GRADIENTS = [
  "linear-gradient(160deg, #F6C177 0%, #ED9B40 45%, #1E8A97 100%)",
  "linear-gradient(160deg, #C6543F 0%, #8A3B4A 55%, #22303A 100%)",
  "linear-gradient(160deg, #ED9B40 0%, #C6543F 50%, #145C6B 100%)",
  "linear-gradient(160deg, #7FD8E0 0%, #1E8A97 55%, #145C6B 100%)",
  "linear-gradient(160deg, #F2A950 0%, #C6543F 60%, #6B2F3A 100%)",
  "linear-gradient(160deg, #A9D6B8 0%, #3E8E5A 55%, #145C6B 100%)",
];

/** Blog cover seeds (frontmatter `coverImage`) → destination image keys. */
export const BLOG_COVER_KEYS: Record<string, string[]> = {
  "japan-kyoto": ["kyoto", "japan"],
  "portugal-coast": ["portugal", "lisbon"],
  "sea-beach": ["thailand", "philippines"],
};

export function fallbackGradient(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length];
}
