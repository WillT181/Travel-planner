import "server-only";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COUPON_ID = "wanderly_referral_free_month";

/**
 * Ensure the shared "one free month" referral coupon exists. 100% off for a
 * single billing cycle. Idempotent — created once, then reused by id.
 */
async function ensureReferralCoupon(stripe: Stripe): Promise<string> {
  try {
    await stripe.coupons.retrieve(COUPON_ID);
    return COUPON_ID;
  } catch {
    const coupon = await stripe.coupons.create({
      id: COUPON_ID,
      percent_off: 100,
      duration: "once",
      name: "Referral reward — one free month",
    });
    return coupon.id;
  }
}

/**
 * Grant the referrer one free month of Pro. Applies the referral coupon to
 * their active subscription when they have one, otherwise to their customer
 * record so it lands on their next Pro invoice. Marks the referral 'rewarded'
 * on success. Best-effort and safe to no-op when Stripe isn't configured.
 */
export async function grantReferralReward(
  referrerId: string,
  referredUserId: string
): Promise<void> {
  if (!isStripeConfigured()) return;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", referrerId)
    .single();

  if (!profile?.stripe_customer_id) return;

  try {
    const stripe = getStripe();
    const coupon = await ensureReferralCoupon(stripe);

    if (profile.stripe_subscription_id) {
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        discounts: [{ coupon }],
      });
    } else {
      // No active subscription yet — attach to the customer so the discount is
      // inherited by their next subscription's first invoice.
      await stripe.customers.update(profile.stripe_customer_id, { coupon });
    }

    // Mark just this referral rewarded (a referrer may have several).
    await admin
      .from("referrals")
      .update({
        status: "rewarded",
        reward_granted_at: new Date().toISOString(),
      })
      .eq("referred_user_id", referredUserId)
      .eq("status", "completed");
  } catch (err) {
    console.error("Failed to grant referral reward:", err);
  }
}
