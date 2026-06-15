"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDestination } from "@/data/destinations";
import type { TimeOfDay } from "@/types/trip";

const FREE_MAX_TRIPS = 3;
const FREE_MAX_DAYS = 5;

export interface ActionResult {
  error?: string;
}

// ── createTrip ───────────────────────────────────────────────────────────────

export async function createTrip(
  destinationSlug: string
): Promise<ActionResult> {
  const destination = getDestination(destinationSlug);
  if (!destination) return { error: "That destination no longer exists." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signup?returnTo=/explore/${destinationSlug}`);
  }

  const { count } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= FREE_MAX_TRIPS) {
    redirect("/pricing?reason=trip_limit");
  }

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination_slug: destination.slug,
      destination_name: destination.name,
      country: destination.country,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "We couldn't start your trip. Please try again." };
  }

  redirect(`/trip/${data.id}`);
}

// ── addDay ───────────────────────────────────────────────────────────────────

export async function addDay(
  tripId: string
): Promise<ActionResult & { dayId?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return { error: "Trip not found." };

  const { count } = await supabase
    .from("trip_days")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if ((count ?? 0) >= FREE_MAX_DAYS) {
    return { error: "free_limit" };
  }

  const nextNum = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("trip_days")
    .insert({ trip_id: tripId, day_number: nextNum })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't add day." };

  revalidatePath(`/trip/${tripId}`);
  return { dayId: data.id };
}

// ── deleteDay ────────────────────────────────────────────────────────────────

export async function deleteDay(
  dayId: string,
  tripId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("trip_days")
    .delete()
    .eq("id", dayId)
    .eq("trip_id", tripId);

  if (error) return { error: "Couldn't delete day." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}

// ── updateDayLabel ───────────────────────────────────────────────────────────

export async function updateDayLabel(
  dayId: string,
  tripId: string,
  label: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("trip_days")
    .update({ label: label.trim() || null })
    .eq("id", dayId)
    .eq("trip_id", tripId);

  if (error) return { error: "Couldn't update day." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}

// ── addActivity ──────────────────────────────────────────────────────────────

export interface ActivityInput {
  timeOfDay: TimeOfDay;
  title: string;
  notes?: string;
  durationMins?: number;
}

export async function addActivity(
  tripDayId: string,
  tripId: string,
  input: ActivityInput
): Promise<ActionResult & { activityId?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase
    .from("activities")
    .insert({
      trip_day_id: tripDayId,
      time_of_day: input.timeOfDay,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      duration_mins: input.durationMins ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't add activity." };

  revalidatePath(`/trip/${tripId}`);
  return { activityId: data.id };
}

// ── updateActivity ───────────────────────────────────────────────────────────

export async function updateActivity(
  activityId: string,
  tripId: string,
  input: Partial<ActivityInput>
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (input.durationMins !== undefined)
    patch.duration_mins = input.durationMins || null;
  if (input.timeOfDay !== undefined) patch.time_of_day = input.timeOfDay;

  const { error } = await supabase
    .from("activities")
    .update(patch)
    .eq("id", activityId);

  if (error) return { error: "Couldn't update activity." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}

// ── deleteActivity ───────────────────────────────────────────────────────────

export async function deleteActivity(
  activityId: string,
  tripId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) return { error: "Couldn't delete activity." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}
