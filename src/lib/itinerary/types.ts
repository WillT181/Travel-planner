import type { TimeOfDay } from "@/types/trip";

export const TIMES_OF_DAY: TimeOfDay[] = ["morning", "afternoon", "evening"];

export const FREE_MAX_TRIPS = 3;
export const FREE_MAX_DAYS = 5;

/** Prefix that marks a trip as living in localStorage, not Supabase. */
export const LOCAL_TRIP_PREFIX = "local-";

export function isLocalTripId(id: string): boolean {
  return id.startsWith(LOCAL_TRIP_PREFIX);
}

export interface BuilderActivity {
  id: string;
  timeOfDay: TimeOfDay;
  title: string;
  notes: string | null;
  cost: number | null;
  sortOrder: number;
  /** "Tick it off" — optional so pre-existing localStorage trips still load. */
  done?: boolean;
}

export interface BuilderDay {
  id: string;
  dayNumber: number;
  /** ISO date (yyyy-mm-dd) or null for undated days. */
  date: string | null;
  activities: BuilderActivity[];
}

export interface BuilderTrip {
  id: string;
  title: string;
  destinationName: string;
  destinationSlug: string;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  travellerCount: number;
  days: BuilderDay[];
}

/** Total of all activity costs across the trip. */
export function tripTotalCost(trip: BuilderTrip): number {
  return trip.days.reduce(
    (sum, day) => sum + day.activities.reduce((s, a) => s + (a.cost ?? 0), 0),
    0
  );
}

/** "Mon 14 Apr" — used in the day tabs. */
export function formatDayDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** ISO date `days` after `startIso`. */
export function addDaysIso(startIso: string, days: number): string {
  const d = new Date(`${startIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day count between two ISO dates (>= 1), or null if unparseable. */
export function inclusiveDayCount(
  startIso: string,
  endIso: string
): number | null {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diff < 0 ? null : diff + 1;
}
