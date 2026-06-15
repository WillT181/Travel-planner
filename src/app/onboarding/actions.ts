"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  recordReferral,
  completeReferralAndReward,
} from "@/lib/referrals/actions";

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

  // Referral attribution + reward. Best-effort: a failure here must never block
  // a user from finishing onboarding.
  try {
    const ref = cookies().get("wl_ref")?.value;
    if (ref) await recordReferral(ref); // safety net if not yet attributed
    await completeReferralAndReward();
    cookies().delete("wl_ref");
  } catch {
    // ignore — reward can be reconciled later
  }

  redirect("/dashboard");
}
