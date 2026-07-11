"use client";

import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
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
  id: string;
  isHighlighted: boolean;
  onSelect: (entry: IndexEntry) => void;
  onMouseEnter: () => void;
}

const ResultRow = forwardRef<HTMLLIElement, ResultRowProps>(function ResultRow(
  { entry, id, isHighlighted, onSelect, onMouseEnter },
  ref
) {
  return (
    <li
      ref={ref}
      id={id}
      role="option"
      aria-selected={isHighlighted}
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => {
        // Prevent the input from blurring before the click registers.
        e.preventDefault();
        onSelect(entry);
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3",
        "border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0",
        isHighlighted ? "bg-primary-50" : "hover:bg-primary-50"
      )}
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
});

export interface DestinationSearchProps {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Extra classes merged onto the input (e.g. to attach a button). */
  inputClassName?: string;
  /**
   * "bare" strips the built-in chrome (border, background, icon) so the
   * combobox can live inside a custom shell like the homepage pill search.
   * Dropdown behaviour is unchanged.
   */
  variant?: "default" | "bare";
  /** Called when the user picks a result. Defaults to logging the selection. */
  onSelect?: (entry: IndexEntry) => void;
  /** Called on Enter when no result is highlighted (free-text submit). */
  onSubmitText?: (text: string) => void;
  /** Notified whenever the raw query text changes (incl. select/clear). */
  onQueryChange?: (query: string) => void;
}

export default function DestinationSearch({
  placeholder = "Search any city or country…",
  autoFocus = false,
  className,
  inputClassName,
  variant = "default",
  onSelect,
  onSubmitText,
  onQueryChange,
}: DestinationSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  // Refs to each interactive row so we can scrollIntoView on keyboard nav.
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  const listboxId = useId();
  const optionPrefix = useId();

  const debouncedQuery = useDebouncedValue(query, 150);

  const { results, totalMatches } = useMemo(
    () => searchDestinations(debouncedQuery, 8),
    [debouncedQuery]
  );

  const hasQuery = debouncedQuery.trim().length > 0;
  const showDropdown = open && query.trim().length > 0;
  const overflow = totalMatches - results.length;

  // Reset highlight whenever the user changes the query.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query]);

  // Scroll the highlighted row into view when navigating with the keyboard.
  useEffect(() => {
    if (highlightedIndex >= 0) {
      rowRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

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
    onQueryChange?.(e.target.value);
    setOpen(true);
  }

  function handleClear() {
    setQuery("");
    onQueryChange?.("");
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleSelect(entry: IndexEntry) {
    if (onSelect) {
      onSelect(entry);
    } else {
      console.log("Selected destination:", entry);
    }
    setQuery(entry.name);
    onQueryChange?.(entry.name);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      // Close and clear highlight but keep the typed query and focus.
      setOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (e.key === "Enter") {
      if (showDropdown && highlightedIndex >= 0 && results[highlightedIndex]) {
        e.preventDefault();
        handleSelect(results[highlightedIndex]);
      } else if (onSubmitText) {
        // Free-text submit — nothing highlighted in the dropdown.
        e.preventDefault();
        setOpen(false);
        onSubmitText(query.trim());
      }
      return;
    }

    if (!showDropdown || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  }

  const activeDescendant =
    showDropdown && highlightedIndex >= 0
      ? `${optionPrefix}-${highlightedIndex}`
      : undefined;

  const isBare = variant === "bare";

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Input */}
      <div className="relative">
        {!isBare && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <SearchIcon />
          </span>
        )}

        <input
          type="text"
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          value={query}
          placeholder={placeholder}
          aria-label="Search destinations"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            isBare
              ? "h-12 w-full border-0 bg-transparent pr-9 text-base text-[#22303A] placeholder:text-neutral-400 focus:outline-none focus:ring-0"
              : "h-14 w-full rounded-xl border border-neutral-200 bg-white pl-12 pr-12 text-base text-neutral-900 shadow-sm transition-shadow placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
            inputClassName
          )}
        />

        {query.length > 0 && (
          <span
            className={cn(
              "absolute inset-y-0 right-0 flex items-center",
              isBare ? "pr-0" : "pr-4"
            )}
          >
            <ClearButton onClick={handleClear} />
          </span>
        )}
      </div>

      {/* Dropdown panel */}
      {showDropdown && (
        <ul
          id={listboxId}
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
              {results.map((entry, index) => (
                <ResultRow
                  key={`${entry.type}-${entry.slug}`}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  id={`${optionPrefix}-${index}`}
                  entry={entry}
                  isHighlighted={index === highlightedIndex}
                  onSelect={handleSelect}
                  onMouseEnter={() => setHighlightedIndex(index)}
                />
              ))}

              {overflow > 0 && (
                <li
                  role="presentation"
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
