"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type Destination,
  type Mood,
  MOODS,
  destinationImage,
} from "@/data/destinations";

type Filter = Mood | "All";

const FILTERS: Filter[] = ["All", ...MOODS];

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <Link
      href={`/explore/${destination.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={destinationImage(destination.imageSeed, 600, 450)}
          alt={`${destination.name}, ${destination.country}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-lg font-semibold text-neutral-900">
            {destination.name}
          </h3>
          <span className="shrink-0 text-sm text-neutral-500">
            {destination.country}
          </span>
        </div>

        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Moods">
          {destination.moods.map((mood) => (
            <li
              key={mood}
              className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700"
            >
              {mood}
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-center gap-1.5 text-sm text-neutral-600">
          <ClockIcon />
          <span>
            <span className="font-medium text-neutral-700">Best time:</span>{" "}
            {destination.bestTimeToVisit}
          </span>
        </p>
      </div>
    </Link>
  );
}

export default function ExploreBrowser({
  destinations,
}: {
  destinations: Destination[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?q= comes from the homepage hero's free-text search.
  const query = (searchParams.get("q") ?? "").trim();

  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return destinations.filter((d) => {
      if (activeFilter !== "All" && !d.moods.includes(activeFilter))
        return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q)
      );
    });
  }, [destinations, activeFilter, query]);

  return (
    <div>
      {/* Mood filter pills */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by mood"
      >
        {FILTERS.map((filter) => {
          const active = filter === activeFilter;
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                active
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Result count */}
      <p className="mt-6 text-sm text-neutral-500" aria-live="polite">
        {filtered.length}{" "}
        {filtered.length === 1 ? "destination" : "destinations"}
        {activeFilter !== "All" ? ` in ${activeFilter}` : ""}
        {query && (
          <>
            {" "}
            matching &ldquo;{query}&rdquo;{" "}
            <button
              type="button"
              onClick={() => router.push("/explore")}
              className="ml-1 font-medium text-primary-700 underline underline-offset-2 hover:text-primary-900"
            >
              Clear
            </button>
          </>
        )}
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <ul className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((destination) => (
            <li key={destination.slug}>
              <DestinationCard destination={destination} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
          <p className="font-medium text-neutral-700">No destinations found</p>
          <p className="mt-1 text-sm text-neutral-500">
            Try a different search term or mood.
          </p>
        </div>
      )}
    </div>
  );
}
