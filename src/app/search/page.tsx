"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePlacesSearch } from "@/hooks/usePlacesSearch";
import SearchBar from "@/components/search/SearchBar";
import SearchResults from "@/components/search/SearchResults";
import DestinationCard from "@/components/search/DestinationCard";
import type {
  AutocompleteResult,
  PlaceDetails,
  PlacesApiError,
} from "@/types/places";
import { isPlacesApiError } from "@/types/places";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [selected, setSelected] = useState<AutocompleteResult | null>(null);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const { results, isLoading, error, clearResults } = usePlacesSearch(query);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const listboxId = useId();
  const optionIdPrefix = useId();

  const hasQuery = query.trim().length > 0;
  const showDropdown = isOpen && hasQuery;

  // Reset keyboard highlight whenever the result set changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Close dropdown on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const fetchDetails = useCallback(async (placeId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const res = await fetch(
        `/api/places/details/${encodeURIComponent(placeId)}`
      );
      const data: PlaceDetails | PlacesApiError = await res.json();

      if (!res.ok || isPlacesApiError(data)) {
        setDetails(null);
        setDetailsError(
          isPlacesApiError(data)
            ? data.error
            : "Could not load destination details."
        );
        return;
      }

      setDetails(data);
    } catch {
      setDetails(null);
      setDetailsError("Network error while loading details. Please try again.");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleSelect = useCallback(
    (result: AutocompleteResult) => {
      setSelected(result);
      setQuery(result.mainText || result.description);
      setIsOpen(false);
      clearResults();
      void fetchDetails(result.placeId);
    },
    [clearResults, fetchDetails]
  );

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setIsOpen(true);
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    setSelected(null);
    setDetails(null);
    setDetailsError(null);
    clearResults();
    inputRef.current?.focus();
  }, [clearResults]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < results.length) {
            e.preventDefault();
            handleSelect(results[activeIndex]);
          }
          break;
        default:
          break;
      }
    },
    [showDropdown, results, activeIndex, handleSelect]
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-8 sm:py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Where do you want to go?
        </h1>
        <p className="mt-3 text-base text-neutral-500 sm:text-lg">
          Search any city, region, or landmark to start planning your trip.
        </p>
      </header>

      <div ref={containerRef} className="relative w-full">
        <SearchBar
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onClear={handleClear}
          isLoading={isLoading}
          listboxId={listboxId}
          isExpanded={showDropdown}
          activeDescendantId={
            activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined
          }
          onKeyDown={handleKeyDown}
        />

        {showDropdown ? (
          <SearchResults
            results={results}
            isLoading={isLoading}
            error={error}
            hasQuery={hasQuery}
            listboxId={listboxId}
            optionIdPrefix={optionIdPrefix}
            activeIndex={activeIndex}
            onSelect={handleSelect}
            onHover={setActiveIndex}
          />
        ) : null}
      </div>

      {selected ? (
        <div className="mt-8 w-full">
          <DestinationCard
            details={details}
            isLoading={detailsLoading}
            error={detailsError}
            onRetry={() => fetchDetails(selected.placeId)}
          />
        </div>
      ) : null}
    </div>
  );
}
