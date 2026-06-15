"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type TravelCompanions = "solo" | "couple" | "family" | "group";

export interface OnboardingAnswers {
  destination: string;
  startDate: string;
  endDate: string;
  companions: TravelCompanions;
  budget: number;
}

export interface OnboardingResult {
  error?: string;
}

export async function saveOnboarding(
  answers: OnboardingAnswers
): Promise<OnboardingResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?returnTo=/onboarding");
  }

  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: user.id,
      first_trip_destination: answers.destination || null,
      trip_start_date: answers.startDate || null,
      trip_end_date: answers.endDate || null,
      travel_companions: answers.companions,
      budget: answers.budget,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return { error: "We couldn't save your answers. Please try again." };
  }

  redirect("/dashboard");
}
