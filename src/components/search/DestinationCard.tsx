"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlaceDetails } from "@/types/places";
import { buttonVariants } from "@/components/ui/Button";

interface DestinationCardProps {
  details: PlaceDetails | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

/** Turn "tourist_attraction" into "Tourist Attraction". */
function humaniseType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Rated ${rating.toFixed(1)} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < rounded ? "text-accent-500" : "text-neutral-300"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function PhotoFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-primary-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </div>
  );
}

function DestinationCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg"
      aria-busy="true"
      aria-label="Loading destination details"
    >
      <div className="aspect-video w-full animate-pulse bg-neutral-200" />
      <div className="space-y-4 p-6">
        <div className="h-7 w-2/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-200" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-lg bg-neutral-200" />
      </div>
    </div>
  );
}

export default function DestinationCard({
  details,
  isLoading,
  error,
  onRetry,
}: DestinationCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (isLoading) return <DestinationCardSkeleton />;

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
      >
        <p className="font-medium text-red-700">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={buttonVariants({
              variant: "secondary",
              className: "mt-4",
            })}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (!details) return null;

  const showPhoto = details.photoUrl && !imageFailed;

  return (
    <article className="animate-[fadeIn_0.3s_ease-out] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={details.photoUrl as string}
            alt={`Photo of ${details.name}`}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PhotoFallback />
        )}
      </div>

      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
            {details.name}
          </h2>
          {details.address ? (
            <p className="mt-1 text-sm text-neutral-500">{details.address}</p>
          ) : null}
        </div>

        {details.rating !== null ? (
          <div className="flex items-center gap-2">
            <StarRating rating={details.rating} />
            <span className="text-sm font-medium text-neutral-700">
              {details.rating.toFixed(1)}
            </span>
            {details.reviewCount !== null ? (
              <span className="text-sm text-neutral-500">
                ({details.reviewCount.toLocaleString()} reviews)
              </span>
            ) : null}
          </div>
        ) : null}

        {details.summary ? (
          <p className="text-base leading-relaxed text-neutral-700">
            {details.summary}
          </p>
        ) : null}

        {details.types.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Place categories">
            {details.types.slice(0, 4).map((type) => (
              <li
                key={type}
                className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
              >
                {humaniseType(type)}
              </li>
            ))}
          </ul>
        ) : null}

        <Link
          href={`/itinerary/new?destination=${encodeURIComponent(details.id)}`}
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          Start Planning
        </Link>
      </div>
    </article>
  );
}
