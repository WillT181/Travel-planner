import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "pro";

/**
 * Reads the signed-in user's plan from user_profiles.
 * Returns "free" when there is no user or no profile row yet.
 *
 * There is no billing integration; flip user_profiles.plan to 'pro' in the
 * Supabase dashboard to unlock Pro features for an account.
 */
export async function getUserPlan(supabase: SupabaseClient): Promise<Plan> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "free";

  const { data } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  return data?.plan === "pro" ? "pro" : "free";
}
