"use client";

import type { AutocompleteResult } from "@/types/places";

interface SearchResultsProps {
  results: AutocompleteResult[];
  isLoading: boolean;
  error: string | null;
  /** Has the user typed a non-empty query? Controls empty-state display. */
  hasQuery: boolean;
  listboxId: string;
  optionIdPrefix: string;
  activeIndex: number;
  onSelect: (result: AutocompleteResult) => void;
  onHover: (index: number) => void;
}

function MarkerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function SearchResults({
  results,
  isLoading,
  error,
  hasQuery,
  listboxId,
  optionIdPrefix,
  activeIndex,
  onSelect,
  onHover,
}: SearchResultsProps) {
  // Nothing to show until the user has typed something.
  if (!hasQuery) return null;

  // Don't flash an empty-state while the first request is still loading.
  const showEmpty = !isLoading && !error && results.length === 0;

  return (
    <ul
      id={listboxId}
      role="listbox"
      aria-label="Destination suggestions"
      className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg"
    >
      {error ? (
        <li role="alert" className="px-4 py-4 text-sm text-red-600">
          {error}
        </li>
      ) : showEmpty ? (
        <li className="px-4 py-6 text-center text-sm text-neutral-500">
          <p className="font-medium text-neutral-700">No results found</p>
          <p className="mt-1">
            Try a different spelling or a broader search term.
          </p>
        </li>
      ) : (
        results.map((result, index) => {
          const isActive = index === activeIndex;
          return (
            <li
              key={result.placeId}
              id={`${optionIdPrefix}-${index}`}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => onHover(index)}
              onMouseDown={(e) => {
                // Prevent input blur before the click registers.
                e.preventDefault();
                onSelect(result);
              }}
              className={`flex cursor-pointer items-start gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 ${
                isActive ? "bg-primary-50" : "hover:bg-neutral-50"
              }`}
            >
              <MarkerIcon />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-neutral-900">
                  {result.mainText || result.description}
                </span>
                {result.secondaryText ? (
                  <span className="block truncate text-sm text-neutral-500">
                    {result.secondaryText}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })
      )}
    </ul>
  );
}
