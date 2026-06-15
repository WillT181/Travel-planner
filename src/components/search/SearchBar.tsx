"use client";

import { forwardRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading?: boolean;
  /** Wired to the listbox for combobox semantics. */
  listboxId?: string;
  isExpanded?: boolean;
  activeDescendantId?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
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

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-primary-600"
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading results"
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
        d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value,
      onChange,
      onClear,
      isLoading = false,
      listboxId,
      isExpanded = false,
      activeDescendantId,
      onKeyDown,
      placeholder = "Search for a city, region, or landmark…",
    },
    ref
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        onClear();
        return;
      }
      onKeyDown?.(e);
    };

    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon />
        </span>

        <input
          ref={ref}
          type="text"
          role="combobox"
          aria-expanded={isExpanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendantId}
          aria-label="Search destinations"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-14 w-full rounded-xl border border-neutral-200 bg-white pl-12 pr-12 text-base text-neutral-900 shadow-sm transition-shadow placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
        />

        <span className="absolute inset-y-0 right-0 flex items-center pr-4">
          {isLoading ? (
            <Spinner />
          ) : value.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <ClearIcon />
            </button>
          ) : null}
        </span>
      </div>
    );
  }
);

SearchBar.displayName = "SearchBar";

export default SearchBar;
