"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { searchDestinations, type IndexEntry } from "@/lib/destinationSearch";
import { cn } from "@/lib/utils";

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

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Clear search"
      className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

interface ResultRowProps {
  entry: IndexEntry;
  onSelect: (entry: IndexEntry) => void;
}

function ResultRow({ entry, onSelect }: ResultRowProps) {
  return (
    <li
      role="option"
      aria-selected={false}
      onMouseDown={(e) => {
        // Prevent the input from blurring before the click registers.
        e.preventDefault();
        onSelect(entry);
      }}
      className="flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-primary-50"
    >
      <span className="shrink-0 text-xl leading-none" aria-hidden="true">
        {entry.flag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-neutral-900">
          {entry.name}
        </span>
        <span className="block truncate text-sm text-neutral-500">
          {entry.secondary}
        </span>
      </span>
    </li>
  );
}

export interface DestinationSearchProps {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export default function DestinationSearch({
  placeholder = "Search any city or country…",
  autoFocus = false,
  className,
}: DestinationSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 150);

  const { results, totalMatches } = useMemo(
    () => searchDestinations(debouncedQuery, 8),
    [debouncedQuery]
  );

  const hasQuery = debouncedQuery.trim().length > 0;
  const showDropdown = open && query.trim().length > 0;
  const overflow = totalMatches - results.length;

  // Close dropdown on outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleClear() {
    setQuery("");
    setOpen(false);
  }

  function handleSelect(entry: IndexEntry) {
    // Navigation wired in the next prompt.
    console.log("Selected destination:", entry);
    setQuery(entry.name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Input */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon />
        </span>

        <input
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          value={query}
          placeholder={placeholder}
          aria-label="Search destinations"
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClear();
          }}
          className="h-14 w-full rounded-xl border border-neutral-200 bg-white pl-12 pr-12 text-base text-neutral-900 shadow-sm transition-shadow placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
        />

        {query.length > 0 && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-4">
            <ClearButton onClick={handleClear} />
          </span>
        )}
      </div>

      {/* Dropdown panel */}
      {showDropdown && (
        <ul
          role="listbox"
          aria-label="Destination suggestions"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg"
        >
          {/* The debounced query may lag the raw query by up to 150 ms; only
              render results/empty-state once the debounce has settled. */}
          {hasQuery && results.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="px-4 py-6 text-center text-sm text-neutral-500"
            >
              No destinations found — try another spelling
            </li>
          ) : (
            <>
              {results.map((entry) => (
                <ResultRow
                  key={`${entry.type}-${entry.slug}`}
                  entry={entry}
                  onSelect={handleSelect}
                />
              ))}

              {overflow > 0 && (
                <li
                  aria-disabled="true"
                  className="border-t border-neutral-100 px-4 py-2.5 text-center text-xs font-medium text-neutral-400"
                >
                  +{overflow} more results
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
