"use server";

import { createClient } from "@/lib/supabase/server";
import { grantReferralReward } from "@/lib/stripe/referral";

/**
 * Attach the signed-in (newly registered) user to a referrer by their code.
 * Idempotent and safe to call with an empty code — the SECURITY DEFINER RPC
 * rejects self-referrals and users who are already attributed.
 */
export async function recordReferral(code: string): Promise<void> {
  if (!code || !code.trim()) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc("record_referral", { _code: code.trim() });
}

/**
 * Called once the referred user finishes onboarding. Flips their referral to
 * 'completed' and, if there was a pending referral, grants the referrer one
 * free month of Pro. Best-effort: never throws into the onboarding flow.
 */
export async function completeReferralAndReward(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: referrerId } = await supabase.rpc("complete_referral");
  if (referrerId && typeof referrerId === "string") {
    await grantReferralReward(referrerId, user.id);
  }
}
