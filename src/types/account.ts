import type { Plan } from "@/lib/auth/plan";

export interface UserProfile {
  id: string;
  display_name: string | null;
  currency: string;
  plan: Plan;
  referral_code: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export type ReferralStatus = "pending" | "completed" | "rewarded";

export interface Referral {
  id: string;
  referred_email: string | null;
  status: ReferralStatus;
  reward_granted_at: string | null;
  created_at: string;
}
