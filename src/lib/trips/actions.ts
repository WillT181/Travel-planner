"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/auth/plan";
import { getDestination } from "@/data/destinations";
import { resolveCatalogDestination } from "@/lib/destinations/catalog";
import { resolveLocalCity } from "@/lib/destinations/local";
import type { TimeOfDay } from "@/types/trip";

const FREE_MAX_TRIPS = 3;
const FREE_MAX_DAYS = 5;

export interface ActionResult {
  error?: string;
}

/**
 * Confirms the signed-in user may edit this trip (owner or editor). Editing
 * permission is enforced in the database via RLS + can_edit_trip(); this gives
 * a friendly early error before we attempt the write.
 */
async function ensureCanEdit(
  supabase: ReturnType<typeof createClient>,
  tripId: string
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated.";

  const { data, error } = await supabase.rpc("can_edit_trip", {
    _trip_id: tripId,
  });
  if (error || data !== true) {
    return "You don't have edit access to this trip.";
  }
  return null;
}

// ── createTrip ───────────────────────────────────────────────────────────────

export async function createTrip(
  destinationSlug: string
): Promise<ActionResult> {
  // Seed guides have rich metadata; otherwise fall back to the generated
  // catalog (any searched country or major city).
  const seed = getDestination(destinationSlug);
  const destination = seed
    ? { slug: seed.slug, name: seed.name, country: seed.country }
    : (() => {
        const place =
          resolveCatalogDestination(destinationSlug) ??
          resolveLocalCity(destinationSlug);
        return place
          ? { slug: place.slug, name: place.name, country: place.country }
          : null;
      })();

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

// ── deleteTrip ───────────────────────────────────────────────────────────────

export async function deleteTrip(tripId: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // RLS delete policy already restricts this to the trip owner.
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("user_id", user.id);

  if (error) return { error: "Couldn't delete that trip." };

  revalidatePath("/dashboard");
  return {};
}

// ── duplicateTrip ──────────────────────────────────────────────────────────

export async function duplicateTrip(tripId: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Free users are capped at FREE_MAX_TRIPS total.
  const plan = await getUserPlan(supabase);
  if (plan !== "pro") {
    const { count } = await supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= FREE_MAX_TRIPS) {
      redirect("/pricing?reason=trip_limit");
    }
  }

  // Read the source trip (RLS allows owners + members to view it).
  const { data: source } = await supabase
    .from("trips")
    .select(
      `
      destination_slug, destination_name, country, title,
      start_date, end_date, traveller_count,
      trip_days ( day_number, date, label,
        activities ( time_of_day, title, notes, duration_mins, cost, sort_order )
      )
    `
    )
    .eq("id", tripId)
    .single();

  if (!source) return { error: "That trip no longer exists." };

  const { data: created, error: tripError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination_slug: source.destination_slug,
      destination_name: source.destination_name,
      country: source.country,
      title: source.title ? `${source.title} (copy)` : null,
      start_date: source.start_date,
      end_date: source.end_date,
      traveller_count: source.traveller_count ?? 1,
      status: "planning",
    })
    .select("id")
    .single();

  if (tripError || !created) return { error: "Couldn't duplicate that trip." };

  // Recreate days, then activities mapped onto their new day ids.
  const days = (source.trip_days ?? []) as {
    day_number: number;
    date: string | null;
    label: string | null;
    activities: {
      time_of_day: string;
      title: string;
      notes: string | null;
      duration_mins: number | null;
      cost: number | null;
      sort_order: number;
    }[];
  }[];

  for (const day of days) {
    const { data: newDay } = await supabase
      .from("trip_days")
      .insert({
        trip_id: created.id,
        day_number: day.day_number,
        date: day.date,
        label: day.label,
      })
      .select("id")
      .single();

    if (newDay && day.activities.length > 0) {
      await supabase.from("activities").insert(
        day.activities.map((a) => ({
          trip_day_id: newDay.id,
          time_of_day: a.time_of_day,
          title: a.title,
          notes: a.notes,
          duration_mins: a.duration_mins,
          cost: a.cost,
          sort_order: a.sort_order,
        }))
      );
    }
  }

  revalidatePath("/dashboard");
  redirect(`/trip/${created.id}`);
}

// ── addDay ───────────────────────────────────────────────────────────────────

export async function addDay(
  tripId: string
): Promise<ActionResult & { dayId?: string }> {
  const supabase = createClient();
  const denied = await ensureCanEdit(supabase, tripId);
  if (denied) return { error: denied };

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
  const denied = await ensureCanEdit(supabase, tripId);
  if (denied) return { error: denied };

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
  const denied = await ensureCanEdit(supabase, tripId);
  if (denied) return { error: denied };

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
  const denied = await ensureCanEdit(supabase, tripId);
  if (denied) return { error: denied };

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
  const denied = await ensureCanEdit(supabase, tripId);
  if (denied) return { error: denied };

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
  const denied = await ensureCanEdit(supabase, tripId);
  if (denied) return { error: denied };

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) return { error: "Couldn't delete activity." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}
