"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createTrip } from "@/lib/trips/actions";
import Button from "@/components/ui/Button";

interface DestinationOption {
  slug: string;
  name: string;
  country: string;
}

export default function NewTripButton({
  destinations,
}: {
  destinations: DestinationOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = destinations.filter((d) =>
    `${d.name} ${d.country}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  function choose(slug: string) {
    setPendingSlug(slug);
    startTransition(async () => {
      // createTrip redirects on success or to /pricing when at the free limit.
      await createTrip(slug);
      setPendingSlug(null);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New trip</Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 p-4 pt-[10vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-trip-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                id="new-trip-title"
                className="text-lg font-bold text-neutral-900"
              >
                Where to next?
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <label htmlFor="dest-search" className="sr-only">
              Search destinations
            </label>
            <input
              id="dest-search"
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 16 destinations…"
              className="mt-4 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {filtered.map((d) => (
                <li key={d.slug}>
                  <button
                    type="button"
                    onClick={() => choose(d.slug)}
                    disabled={isPending}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:opacity-50"
                  >
                    <span>
                      <span className="font-medium text-neutral-900">
                        {d.name}
                      </span>
                      <span className="ml-2 text-sm text-neutral-500">
                        {d.country}
                      </span>
                    </span>
                    {pendingSlug === d.slug ? (
                      <span className="text-xs text-neutral-400">Opening…</span>
                    ) : null}
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-neutral-500">
                  No destinations match “{query}”.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
