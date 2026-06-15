"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AutocompleteResult } from "@/types/places";
import { isPlacesApiError } from "@/types/places";

const DEBOUNCE_MS = 350;

interface UsePlacesSearchReturn {
  results: AutocompleteResult[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

/**
 * Debounced autocomplete search against /api/places/autocomplete.
 * Empty/whitespace input clears results and makes no request.
 * In-flight requests are aborted when the input changes.
 */
export function usePlacesSearch(input: string): UsePlacesSearchReturn {
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const clearResults = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const trimmed = input.trim();

    // Empty input: clear everything, no API call.
    if (trimmed.length === 0) {
      abortRef.current?.abort();
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      // Cancel any previous in-flight request.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: trimmed }),
          signal: controller.signal,
        });

        const data: unknown = await res.json();

        if (!res.ok) {
          const message = isPlacesApiError(data)
            ? data.error
            : "Search failed. Please try again.";
          setResults([]);
          setError(message);
          return;
        }

        setResults(Array.isArray(data) ? (data as AutocompleteResult[]) : []);
        setError(null);
      } catch (err) {
        // Aborted requests are expected — ignore them.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
        setError("Network error. Check your connection and try again.");
      } finally {
        if (abortRef.current === controller || !abortRef.current) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [input]);

  // Abort any outstanding request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { results, isLoading, error, clearResults };
}
