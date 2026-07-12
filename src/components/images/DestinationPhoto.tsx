import Image from "next/image";
import {
  blurDataUrl,
  creditUrl,
  fallbackGradient,
  resolveImage,
  unsplashSrc,
  UNSPLASH_UTM,
} from "@/lib/images";

export interface DestinationPhotoProps {
  /** Lookup keys tried in order against images.json (see slugKeys()). */
  imageKeys: (string | null | undefined)[];
  /** Shown on the gradient fallback and used in fallback alt text. */
  name: string;
  /**
   * next/image `sizes` for this context, e.g.
   * "(max-width: 640px) 100vw, 33vw" for a 3-up card grid.
   */
  sizes: string;
  className?: string;
  /** Above-the-fold hero only. */
  priority?: boolean;
  /** Show the photographer credit overlay (heroes). */
  credit?: boolean;
  /** Hide the destination name on the gradient fallback (small cards). */
  plainFallback?: boolean;
}

/**
 * The one way destination imagery is rendered. Curated Unsplash photo via
 * next/image (blur placeholder from the dominant colour, zero CLS via fill
 * inside the caller's sized container) — or a branded gradient fallback.
 * Never a broken image, never a placeholder service.
 *
 * The parent element must be `position: relative` with a fixed aspect/height.
 */
export default function DestinationPhoto({
  imageKeys,
  name,
  sizes,
  className = "",
  priority = false,
  credit = false,
  plainFallback = false,
}: DestinationPhotoProps) {
  const image = resolveImage(...imageKeys);

  if (!image) {
    return (
      <div
        aria-label={`${name} — photo coming soon`}
        role="img"
        className={`absolute inset-0 ${className}`}
        style={{ background: fallbackGradient(imageKeys[0] ?? name) }}
      >
        {!plainFallback && (
          <span className="absolute bottom-3 left-4 font-display text-lg font-bold text-white/85 drop-shadow-sm">
            {name}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <Image
        // Capped source: the optimizer never pulls more than 2400px from
        // Unsplash, and generates AVIF/WebP variants per device width.
        src={unsplashSrc(image, 2400)}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={blurDataUrl(image.color)}
        className={`object-cover ${className}`}
      />
      {credit && (
        <span className="absolute bottom-2 right-3 z-10 text-[11px] text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          Photo:{" "}
          <a
            href={creditUrl(image.photographerUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white"
          >
            {image.photographer}
          </a>{" "}
          /{" "}
          <a
            href={`https://unsplash.com${UNSPLASH_UTM}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white"
          >
            Unsplash
          </a>
        </span>
      )}
    </>
  );
}
