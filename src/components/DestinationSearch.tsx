"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import countriesRaw from "@/data/destinations/countries.json";
import type { CitySearchResult } from "@/types/places";

/**
 * Global destination search. Countries are searched entirely client-side (the
 * small countries.json is bundled); cities come from /api/cities/search, which
 * is backed by the full ~156k-city dataset in the database. Results merge into
 * one debounced, ranked, keyboard-navigable dropdown that routes to
 * /explore/{slug} on select.
 *
 * NOTE: no city JSON is imported here — cities.major.json / cities.full.json
 * are far too large for the client bundle, so cities are fetched on demand.
 */

interface RawCountry {
  id: string;
  name: string;
  slug: string;
  region: string;
  flag: string | null;
}

interface SearchItem {
  kind: "country" | "city";
  name: string;
  /** Lowercased name, precomputed so the per-keystroke filter is cheap. */
  lower: string;
  slug: string;
  flag: string;
  secondary: string;
  isCapital: boolean;
}

const MAX_RESULTS = 8;
const DEBOUNCE_MS = 150;

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

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-primary-600"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

export default function DestinationSearch({
  placeholder = "Search any city or country…",
  autoFocus = false,
  className = "",
}: {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [cityItems, setCityItems] = useState<SearchItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const optionPrefix = useId();

  // Build the (small) country index exactly once — cities are fetched on demand.
  const countryItems = useMemo<SearchItem[]>(() => {
    return (countriesRaw as RawCountry[]).map((c) => ({
      kind: "country",
      name: c.name,
      lower: c.name.toLowerCase(),
      slug: c.slug,
      flag: c.flag ?? "🌍",
      secondary: `Country · ${c.region}`,
      isCapital: false,
    }));
  }, []);

  // Debounce the query that drives filtering + the city fetch.
  useEffect(() => {
    const t = setTimeout(
      () => setDebounced(query.trim().toLowerCase()),
      DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [query]);

  // Fetch matching cities from the server (full dataset) for the debounced query.
  useEffect(() => {
    if (!debounced) {
      setCityItems([]);
      setIsFetching(false);
      return;
    }

    const controller = new AbortController();
    setIsFetching(true);

    fetch(`/api/cities/search?q=${encodeURIComponent(debounced)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CitySearchResult[]) => {
        setCityItems(
          (Array.isArray(data) ? data : []).map((c) => ({
            kind: "city",
            name: c.name,
            lower: c.name.toLowerCase(),
            slug: c.slug,
            flag: c.flag ?? "📍",
            secondary: `City · ${c.country}`,
            isCapital: c.isCapital,
          }))
        );
        setIsFetching(false);
      })
      .catch((err) => {
        // Ignore aborts from superseded keystrokes; clear on real failures.
        if (err?.name !== "AbortError") {
          setCityItems([]);
          setIsFetching(false);
        }
      });

    return () => controller.abort();
  }, [debounced]);

  // All matches (ranked), plus the capped slice shown in the dropdown.
  const { visible, total } = useMemo(() => {
    const q = debounced;
    if (!q) return { visible: [] as SearchItem[], total: 0 };

    const countryMatches = countryItems.filter((it) => it.lower.includes(q));
    const matches = [...countryMatches, ...cityItems];

    matches.sort((a, b) => score(a, q) - score(b, q) || tieBreak(a, b));

    return { visible: matches.slice(0, MAX_RESULTS), total: matches.length };
  }, [countryItems, cityItems, debounced]);

  const showDropdown = open && query.trim().length > 0;
  const moreCount = total - visible.length;

  // Reset the highlight whenever the visible set changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function select(item: SearchItem) {
    setOpen(false);
    setQuery("");
    router.push(`/explore/${item.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!showDropdown || visible.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % visible.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? visible.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const idx = activeIndex >= 0 ? activeIndex : 0;
      if (visible[idx]) {
        e.preventDefault();
        select(visible[idx]);
      }
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon />
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${optionPrefix}-${activeIndex}` : undefined
          }
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search destinations"
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-14 w-full rounded-xl border border-neutral-200 bg-white pl-12 pr-4 text-base text-neutral-900 shadow-sm transition-shadow placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
        />
      </div>

      {showDropdown ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
          role="presentation"
        >
          {visible.length > 0 ? (
            <ul id={listboxId} role="listbox" aria-label="Destination results">
              {visible.map((item, i) => {
                const active = i === activeIndex;
                return (
                  <li
                    key={`${item.kind}-${item.slug}`}
                    id={`${optionPrefix}-${i}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      // Prevent the input losing focus before navigation.
                      e.preventDefault();
                      select(item);
                    }}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active ? "bg-primary-50" : "hover:bg-neutral-50"
                    }`}
                  >
                    <span className="text-xl leading-none" aria-hidden="true">
                      {item.flag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-neutral-900">
                        {item.name}
                      </span>
                      <span className="block truncate text-sm text-neutral-500">
                        {item.secondary}
                      </span>
                    </span>
                    {item.isCapital ? (
                      <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                        Capital
                      </span>
                    ) : null}
                  </li>
                );
              })}

              {isFetching ? (
                <li
                  role="presentation"
                  className="flex items-center justify-center gap-2 border-t border-neutral-100 px-4 py-2 text-sm text-neutral-500"
                >
                  <Spinner />
                  <span>Searching cities…</span>
                </li>
              ) : moreCount > 0 ? (
                <li
                  role="presentation"
                  className="border-t border-neutral-100 px-4 py-2 text-center text-sm text-neutral-500"
                >
                  +{moreCount} more — keep typing to narrow it down
                </li>
              ) : null}
            </ul>
          ) : isFetching ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-neutral-500">
              <Spinner />
              <span>Searching…</span>
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-neutral-700">
                No destinations found
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Try another spelling.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Lower score = higher rank. Priority: prefix match, then capitals, then any
 * substring (contains) match.
 */
function score(item: SearchItem, q: string): number {
  const isPrefix = item.lower.startsWith(q);
  if (isPrefix && item.isCapital) return 0;
  if (isPrefix) return 1;
  if (item.isCapital) return 2;
  return 3;
}

/** Stable tie-break: shorter names first, then alphabetical. */
function tieBreak(a: SearchItem, b: SearchItem): number {
  return a.name.length - b.name.length || a.name.localeCompare(b.name);
}
