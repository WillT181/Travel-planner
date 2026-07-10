/**
 * localStorage persistence for anonymous trips.  Client-only — every function
 * no-ops safely when window is unavailable (SSR render pass).
 *
 * One anonymous trip is kept at a time under a stable key, so a logged-out
 * visitor's work survives refreshes and browser restarts until they sign up
 * (at which point the trip is imported into Supabase and the key cleared).
 */

import {
  addDaysIso,
  inclusiveDayCount,
  LOCAL_TRIP_PREFIX,
  type BuilderDay,
  type BuilderTrip,
} from "./types";

const STORAGE_KEY = "wanderly:anon-trip";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // Storage blocked (private mode / permissions)
  }
}

export function loadLocalTrip(): BuilderTrip | null {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const trip = JSON.parse(raw) as BuilderTrip;
    return trip && typeof trip.id === "string" && Array.isArray(trip.days)
      ? trip
      : null;
  } catch {
    return null;
  }
}

export function saveLocalTrip(trip: BuilderTrip): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(trip));
}

export function clearLocalTrip(): void {
  storage()?.removeItem(STORAGE_KEY);
}

function localId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${LOCAL_TRIP_PREFIX}${uuid}`;
}

export interface NewTripInput {
  destinationName: string;
  destinationSlug: string;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  travellerCount: number;
  /** Cap on how many day rows to create from the date range. */
  maxDays: number;
}

/** Build the day list for a new trip from its date range (or one blank day). */
export function buildInitialDays(
  input: Pick<NewTripInput, "startDate" | "endDate" | "maxDays">,
  makeId: () => string
): BuilderDay[] {
  let count = 1;
  if (input.startDate && input.endDate) {
    count = Math.min(
      inclusiveDayCount(input.startDate, input.endDate) ?? 1,
      input.maxDays
    );
  }
  return Array.from({ length: count }, (_, i) => ({
    id: makeId(),
    dayNumber: i + 1,
    date: input.startDate ? addDaysIso(input.startDate, i) : null,
    activities: [],
  }));
}

/** Create + persist a fresh anonymous trip; returns it (with local- id). */
export function createLocalTrip(input: NewTripInput): BuilderTrip {
  const trip: BuilderTrip = {
    id: localId(),
    title: `Trip to ${input.destinationName}`,
    destinationName: input.destinationName,
    destinationSlug: input.destinationSlug,
    country: input.country,
    startDate: input.startDate,
    endDate: input.endDate,
    travellerCount: input.travellerCount,
    days: buildInitialDays(input, localId),
  };
  saveLocalTrip(trip);
  return trip;
}
