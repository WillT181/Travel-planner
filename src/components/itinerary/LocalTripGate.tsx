"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ItineraryBuilder from "@/components/itinerary/ItineraryBuilder";
import { importLocalTrip } from "@/lib/itinerary/actions";
import { clearLocalTrip, loadLocalTrip } from "@/lib/itinerary/local";
import type { BuilderTrip } from "@/lib/itinerary/types";

type GateState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "migrating" }
  | { status: "ready"; trip: BuilderTrip; importBlocked: boolean };

/**
 * Client gate for anonymous (localStorage) trips.
 *
 * - Logged out: loads the trip from localStorage and renders the builder in
 *   local mode (with the sign-up banner).
 * - Logged in (i.e. the visitor just signed up and returned here): imports
 *   the trip into Supabase, clears localStorage, and swaps to the real URL.
 *   If they're already at the free trip cap, the trip stays local and an
 *   upgrade card explains why.
 */
export default function LocalTripGate({
  tripId,
  isAuthed,
}: {
  tripId: string;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ status: "loading" });
  const migrationStarted = useRef(false);

  useEffect(() => {
    const trip = loadLocalTrip();
    if (!trip || trip.id !== tripId) {
      setState({ status: "missing" });
      return;
    }

    if (isAuthed && !migrationStarted.current) {
      migrationStarted.current = true;
      setState({ status: "migrating" });
      void importLocalTrip(trip).then((result) => {
        if (result.tripId) {
          clearLocalTrip();
          router.replace(`/itinerary/${result.tripId}`);
        } else if (result.error === "trip_limit") {
          setState({ status: "ready", trip, importBlocked: true });
        } else {
          // Import failed — keep planning locally rather than losing work.
          setState({ status: "ready", trip, importBlocked: false });
        }
      });
      return;
    }

    setState({ status: "ready", trip, importBlocked: false });
  }, [tripId, isAuthed, router]);

  if (state.status === "loading" || state.status === "migrating") {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        <p className="mt-4 text-sm text-neutral-500">
          {state.status === "migrating"
            ? "Saving your trip to your account…"
            : "Loading your trip…"}
        </p>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Trip not found
        </h1>
        <p className="mt-3 text-neutral-600">
          This trip lives in the browser it was created in, and we couldn&apos;t
          find it here. It may have been cleared, or saved on another device.
        </p>
        <Link
          href="/itinerary"
          className="mt-6 inline-flex rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          Start a new trip
        </Link>
      </div>
    );
  }

  return (
    <ItineraryBuilder
      initialTrip={state.trip}
      mode="local"
      isAuthed={isAuthed}
      importBlocked={state.importBlocked}
    />
  );
}
