"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/auth/plan";
import type { TimeOfDay } from "@/types/trip";
import {
  FREE_MAX_DAYS,
  FREE_MAX_TRIPS,
  inclusiveDayCount,
  addDaysIso,
  type BuilderTrip,
} from "./types";

/**
 * Server actions for the /itinerary builder.  All mutations are owner-scoped
 * (RLS enforces the same in the database) and free-plan limits are enforced
 * here as well as in the UI:  max FREE_MAX_TRIPS trips, FREE_MAX_DAYS days.
 *
 * Limit hits return { error: "trip_limit" | "day_limit" } — the UI renders
 * these as benefit-framed upgrade cards, never raw errors.
 */

export interface ItineraryActionResult {
  error?: string;
}

function cleanCost(cost: number | null | undefined): number | null {
  if (cost == null || Number.isNaN(cost)) return null;
  return Math.round(Math.max(0, cost) * 100) / 100;
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Owner check for day/activity mutations. */
async function ownsTrip(
  supabase: ReturnType<typeof createClient>,
  tripId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

// ── createItineraryTrip ──────────────────────────────────────────────────────

export interface CreateTripInput {
  destinationName: string;
  destinationSlug: string;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  travellerCount: number;
}

export async function createItineraryTrip(
  input: CreateTripInput
): Promise<ItineraryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };

  const name = input.destinationName.trim();
  if (!name) return { error: "Please choose a destination." };

  const plan = await getUserPlan(supabase);

  if (plan !== "pro") {
    const { count } = await supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= FREE_MAX_TRIPS) return { error: "trip_limit" };
  }

  const travellerCount = Math.min(Math.max(1, input.travellerCount || 1), 16);

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination_slug: input.destinationSlug || name.toLowerCase(),
      destination_name: name,
      country: input.country,
      title: `Trip to ${name}`,
      start_date: input.startDate,
      end_date: input.endDate,
      traveller_count: travellerCount,
    })
    .select("id")
    .single();

  if (error || !trip) {
    return { error: "We couldn't start your trip. Please try again." };
  }

  // Create one day per date in the range (capped for free users), or a
  // single blank day when no dates were given.
  const maxDays = plan === "pro" ? 60 : FREE_MAX_DAYS;
  let dayCount = 1;
  if (input.startDate && input.endDate) {
    dayCount = Math.min(
      inclusiveDayCount(input.startDate, input.endDate) ?? 1,
      maxDays
    );
  }

  await supabase.from("trip_days").insert(
    Array.from({ length: dayCount }, (_, i) => ({
      trip_id: trip.id,
      day_number: i + 1,
      date: input.startDate ? addDaysIso(input.startDate, i) : null,
    }))
  );

  redirect(`/itinerary/${trip.id}`);
}

// ── importLocalTrip ──────────────────────────────────────────────────────────

/**
 * Migrates an anonymous localStorage trip into Supabase after sign-up.
 * Returns the new trip id so the client can clear localStorage and swap URLs.
 */
export async function importLocalTrip(
  payload: BuilderTrip
): Promise<ItineraryActionResult & { tripId?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };

  const plan = await getUserPlan(supabase);
  if (plan !== "pro") {
    const { count } = await supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= FREE_MAX_TRIPS) return { error: "trip_limit" };
  }

  const name = String(payload.destinationName ?? "").trim() || "My trip";

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination_slug: payload.destinationSlug || name.toLowerCase(),
      destination_name: name,
      country: payload.country,
      title: String(payload.title ?? `Trip to ${name}`).slice(0, 120),
      start_date: payload.startDate,
      end_date: payload.endDate,
      traveller_count: Math.min(Math.max(1, payload.travellerCount || 1), 16),
    })
    .select("id")
    .single();

  if (error || !trip) return { error: "Couldn't save your trip." };

  const maxDays = plan === "pro" ? 60 : FREE_MAX_DAYS;
  const days = (payload.days ?? []).slice(0, maxDays);

  for (const day of days) {
    const { data: newDay } = await supabase
      .from("trip_days")
      .insert({
        trip_id: trip.id,
        day_number: day.dayNumber,
        date: day.date,
      })
      .select("id")
      .single();

    if (newDay && day.activities?.length) {
      await supabase.from("activities").insert(
        day.activities.map((a) => ({
          trip_day_id: newDay.id,
          time_of_day: a.timeOfDay,
          title: String(a.title ?? "").slice(0, 200) || "Untitled",
          notes: a.notes ? String(a.notes).slice(0, 2000) : null,
          cost: cleanCost(a.cost),
          sort_order: a.sortOrder ?? 0,
          done: Boolean(a.done),
        }))
      );
    }
  }

  revalidatePath("/dashboard");
  return { tripId: trip.id };
}

// ── trip meta ────────────────────────────────────────────────────────────────

export async function renameTrip(
  tripId: string,
  title: string
): Promise<ItineraryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!(await ownsTrip(supabase, tripId, user.id)))
    return { error: "not_found" };

  const { error } = await supabase
    .from("trips")
    .update({ title: title.trim().slice(0, 120) || null })
    .eq("id", tripId);

  if (error) return { error: "Couldn't rename trip." };
  revalidatePath(`/itinerary/${tripId}`);
  return {};
}

// ── days ─────────────────────────────────────────────────────────────────────

export async function addDayToTrip(
  tripId: string
): Promise<ItineraryActionResult & { dayId?: string; date?: string | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!(await ownsTrip(supabase, tripId, user.id)))
    return { error: "not_found" };

  const plan = await getUserPlan(supabase);

  const { data: existing } = await supabase
    .from("trip_days")
    .select("day_number, date")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: false })
    .limit(1);

  const last = existing?.[0];
  const nextNumber = (last?.day_number ?? 0) + 1;

  if (plan !== "pro" && nextNumber > FREE_MAX_DAYS) {
    return { error: "day_limit" };
  }

  const nextDate = last?.date ? addDaysIso(last.date, 1) : null;

  const { data, error } = await supabase
    .from("trip_days")
    .insert({ trip_id: tripId, day_number: nextNumber, date: nextDate })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't add day." };

  revalidatePath(`/itinerary/${tripId}`);
  return { dayId: data.id, date: nextDate };
}

export async function deleteDayFromTrip(
  tripId: string,
  dayId: string
): Promise<ItineraryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!(await ownsTrip(supabase, tripId, user.id)))
    return { error: "not_found" };

  const { error } = await supabase
    .from("trip_days")
    .delete()
    .eq("id", dayId)
    .eq("trip_id", tripId);

  if (error) return { error: "Couldn't delete day." };
  revalidatePath(`/itinerary/${tripId}`);
  return {};
}

// ── activities ───────────────────────────────────────────────────────────────

export interface ActivityPayload {
  timeOfDay: TimeOfDay;
  title: string;
  notes: string | null;
  cost: number | null;
  sortOrder: number;
  done?: boolean;
}

export async function addActivityToDay(
  tripId: string,
  dayId: string,
  input: ActivityPayload
): Promise<ItineraryActionResult & { activityId?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!(await ownsTrip(supabase, tripId, user.id)))
    return { error: "not_found" };

  const title = input.title.trim().slice(0, 200);
  if (!title) return { error: "Title is required." };

  const { data, error } = await supabase
    .from("activities")
    .insert({
      trip_day_id: dayId,
      time_of_day: input.timeOfDay,
      title,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
      cost: cleanCost(input.cost),
      sort_order: input.sortOrder,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't add activity." };

  revalidatePath(`/itinerary/${tripId}`);
  return { activityId: data.id };
}

export async function updateActivityInDay(
  tripId: string,
  activityId: string,
  input: Partial<ActivityPayload>
): Promise<ItineraryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!(await ownsTrip(supabase, tripId, user.id)))
    return { error: "not_found" };

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim().slice(0, 200);
    if (!title) return { error: "Title is required." };
    patch.title = title;
  }
  if (input.notes !== undefined)
    patch.notes = input.notes?.trim()
      ? input.notes.trim().slice(0, 2000)
      : null;
  if (input.cost !== undefined) patch.cost = cleanCost(input.cost);
  if (input.timeOfDay !== undefined) patch.time_of_day = input.timeOfDay;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.done !== undefined) patch.done = Boolean(input.done);

  const { error } = await supabase
    .from("activities")
    .update(patch)
    .eq("id", activityId);

  if (error) return { error: "Couldn't update activity." };
  revalidatePath(`/itinerary/${tripId}`);
  return {};
}

export async function deleteActivityFromDay(
  tripId: string,
  activityId: string
): Promise<ItineraryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!(await ownsTrip(supabase, tripId, user.id)))
    return { error: "not_found" };

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) return { error: "Couldn't delete activity." };
  revalidatePath(`/itinerary/${tripId}`);
  return {};
}

/** Persist new sort_order (and section) for the activities of one day. */
export async function reorderDayActivities(
  tripId: string,
  updates: { id: string; sortOrder: number; timeOfDay: TimeOfDay }[]
): Promise<ItineraryActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!(await ownsTrip(supabase, tripId, user.id)))
    return { error: "not_found" };

  for (const u of updates) {
    const { error } = await supabase
      .from("activities")
      .update({ sort_order: u.sortOrder, time_of_day: u.timeOfDay })
      .eq("id", u.id);
    if (error) return { error: "Couldn't save the new order." };
  }

  revalidatePath(`/itinerary/${tripId}`);
  return {};
}
