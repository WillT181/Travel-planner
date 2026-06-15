/**
 * Trip "completion score" — a 0–100 measure of how fleshed-out a trip is,
 * shown on the dashboard's upcoming-trip card to nudge planning along.
 */

export interface ScoreableDay {
  activities: { id: string }[];
}

export interface ScoreableTrip {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  traveller_count: number | null;
  trip_days: ScoreableDay[];
}

/** Inclusive number of nights+1 between two ISO dates, or null if unknown. */
export function expectedDays(
  startDate: string | null,
  endDate: string | null
): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Weighted score:
 *  - 20%  trip basics (title, both dates, travellers)
 *  - 40%  days created vs. the date range (or just "has days" if no range)
 *  - 40%  each created day having at least one activity
 */
export function completionScore(trip: ScoreableTrip): number {
  // Basics — up to 20 points.
  let basics = 0;
  if (trip.title && trip.title.trim()) basics += 8;
  if (trip.start_date && trip.end_date) basics += 8;
  if ((trip.traveller_count ?? 0) >= 1) basics += 4;

  const daysCreated = trip.trip_days.length;
  const target = expectedDays(trip.start_date, trip.end_date);

  // Day coverage — up to 40 points.
  let dayCoverage = 0;
  if (target && target > 0) {
    dayCoverage = Math.min(daysCreated / target, 1) * 40;
  } else if (daysCreated > 0) {
    dayCoverage = 40; // no date range to measure against, but days exist
  }

  // Activity coverage — up to 40 points.
  let activityCoverage = 0;
  if (daysCreated > 0) {
    const filled = trip.trip_days.filter((d) => d.activities.length > 0).length;
    activityCoverage = (filled / daysCreated) * 40;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(basics + dayCoverage + activityCoverage))
  );
}
