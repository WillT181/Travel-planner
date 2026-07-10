"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DestinationSearch from "@/components/DestinationSearch";
import UpgradeCard from "@/components/itinerary/UpgradeCard";
import type { IndexEntry } from "@/lib/destinationSearch";
import { createItineraryTrip } from "@/lib/itinerary/actions";
import { createLocalTrip, loadLocalTrip } from "@/lib/itinerary/local";
import {
  FREE_MAX_DAYS,
  inclusiveDayCount,
  type BuilderTrip,
} from "@/lib/itinerary/types";

interface Picked {
  name: string;
  slug: string;
  country: string | null;
}

/** "City · France" / "Country · Europe" → the country a trip belongs to. */
function countryFromEntry(entry: IndexEntry): string | null {
  if (entry.type === "country") return entry.name;
  const [, country] = entry.secondary.split("·").map((s) => s.trim());
  return country || null;
}

export default function StartTripForm({ isAuthed }: { isAuthed: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [picked, setPicked] = useState<Picked | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travellers, setTravellers] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [tripLimitHit, setTripLimitHit] = useState(false);
  const [resumeTrip, setResumeTrip] = useState<BuilderTrip | null>(null);

  // Offer to resume a saved anonymous trip (client-only — localStorage).
  useEffect(() => {
    if (!isAuthed) setResumeTrip(loadLocalTrip());
  }, [isAuthed]);

  const dayCount =
    startDate && endDate ? inclusiveDayCount(startDate, endDate) : null;
  const datesInvalid = Boolean(startDate && endDate && dayCount === null);
  const overFreeDays = dayCount !== null && dayCount > FREE_MAX_DAYS;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!picked) {
      setError("Choose a destination to get started.");
      return;
    }
    if (datesInvalid) {
      setError("The end date must be after the start date.");
      return;
    }

    const input = {
      destinationName: picked.name,
      destinationSlug: picked.slug,
      country: picked.country,
      startDate: startDate || null,
      endDate: endDate || null,
      travellerCount: travellers,
    };

    if (isAuthed) {
      startTransition(async () => {
        const result = await createItineraryTrip(input);
        // On success the action redirects — we only land here on failure.
        if (result?.error === "trip_limit") setTripLimitHit(true);
        else if (result?.error) setError(result.error);
      });
    } else {
      const trip = createLocalTrip({ ...input, maxDays: FREE_MAX_DAYS });
      router.push(`/itinerary/${trip.id}`);
    }
  }

  if (tripLimitHit) {
    return <UpgradeCard variant="trips" className="max-w-lg" />;
  }

  return (
    <div className="max-w-lg">
      {resumeTrip && (
        <Link
          href={`/itinerary/${resumeTrip.id}`}
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm transition-colors hover:bg-primary-100"
        >
          <span className="text-primary-900">
            <span className="font-semibold">Pick up where you left off:</span>{" "}
            {resumeTrip.title}
          </span>
          <span aria-hidden="true" className="shrink-0 text-primary-700">
            →
          </span>
        </Link>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Destination */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Where are you going?
          </label>
          <DestinationSearch
            placeholder="Search any city or country…"
            onSelect={(entry) =>
              setPicked({
                name: entry.name,
                slug: entry.slug,
                country: countryFromEntry(entry),
              })
            }
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="trip-start"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Start date
            </label>
            <input
              id="trip-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label
              htmlFor="trip-end"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              End date
            </label>
            <input
              id="trip-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {dayCount !== null && !datesInvalid && (
          <p className="text-sm text-neutral-500">
            {dayCount} day{dayCount === 1 ? "" : "s"}
            {overFreeDays && (
              <span className="text-neutral-400">
                {" "}
                — free plans include {FREE_MAX_DAYS} planned days; you can add
                the rest with Pro.
              </span>
            )}
          </p>
        )}

        {/* Travellers */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Travellers
          </label>
          <div className="inline-flex items-center rounded-xl border border-neutral-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setTravellers((n) => Math.max(1, n - 1))}
              disabled={travellers <= 1}
              aria-label="Fewer travellers"
              className="flex h-11 w-11 items-center justify-center rounded-l-xl text-lg text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="w-12 text-center text-sm font-semibold text-neutral-900"
            >
              {travellers}
            </span>
            <button
              type="button"
              onClick={() => setTravellers((n) => Math.min(16, n + 1))}
              disabled={travellers >= 16}
              aria-label="More travellers"
              className="flex h-11 w-11 items-center justify-center rounded-r-xl text-lg text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              +
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="h-12 w-full rounded-xl bg-primary-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
        >
          {isPending ? "Creating your trip…" : "Start planning →"}
        </button>

        {!isAuthed && (
          <p className="text-center text-xs text-neutral-500">
            No account needed — your plan is saved in this browser until you
            sign up.
          </p>
        )}
      </form>
    </div>
  );
}
