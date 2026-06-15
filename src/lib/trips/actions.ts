"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDestination } from "@/data/destinations";

export interface CreateTripResult {
  error?: string;
}

/**
 * Creates a new trip for the signed-in user and redirects to /trip/[id].
 * Logged-out users are sent to sign-up first (returning here afterwards).
 */
export async function createTrip(
  destinationSlug: string
): Promise<CreateTripResult> {
  const destination = getDestination(destinationSlug);
  if (!destination) {
    return { error: "That destination no longer exists." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Prompt sign-up, then come back to this destination.
    redirect(`/signup?returnTo=/explore/${destinationSlug}`);
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
