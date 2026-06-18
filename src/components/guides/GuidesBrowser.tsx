"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GuideMeta } from "@/lib/guides";

interface RegionGroup {
  region: string;
  guides: GuideMeta[];
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function GuideCard({ guide }: { guide: GuideMeta }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://picsum.photos/seed/${guide.slug}/480/360`}
          alt={guide.country}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold text-neutral-900">
            {guide.country}
          </h3>
        </div>
        {guide.quickFacts.bestMonths && (
          <p className="mt-1 text-xs text-neutral-500">
            Best time: {guide.quickFacts.bestMonths}
          </p>
        )}
        <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
          {guide.description}
        </p>
      </div>
    </Link>
  );
}

export default function GuidesBrowser({
  groups,
  totalCount,
}: {
  groups: RegionGroup[];
  totalCount: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo<RegionGroup[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        guides: g.guides.filter((guide) =>
          guide.country.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.guides.length > 0);
  }, [query, groups]);

  const visibleCount = filtered.reduce((n, g) => n + g.guides.length, 0);

  return (
    <>
      {/* Search */}
      <div className="relative mb-8 max-w-md">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by country…"
          aria-label="Filter guides by country"
          className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-12 pr-4 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Result count (while searching) */}
      {query.trim() && (
        <p className="mb-6 text-sm text-neutral-500">
          {visibleCount === 0
            ? "No guides match your search."
            : `${visibleCount} of ${totalCount} guides`}
        </p>
      )}

      {/* Grouped grid */}
      <div className="space-y-12">
        {filtered.map(({ region, guides }) => (
          <section key={region}>
            <h2 className="mb-5 text-lg font-bold tracking-tight text-neutral-900">
              {region}
              <span className="ml-2 text-sm font-normal text-neutral-400">
                ({guides.length})
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {guides.map((guide) => (
                <GuideCard key={guide.slug} guide={guide} />
              ))}
            </div>
          </section>
        ))}

        {filtered.length === 0 && query.trim() && (
          <p className="text-center text-neutral-500">
            No guides found for &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </>
  );
}
