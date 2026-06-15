"use server";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { priceIdFor, type BillingInterval } from "@/lib/stripe/config";

export interface CheckoutResult {
  url?: string;
  error?: string;
}

function getOrigin(): string {
  const hdrs = headers();
  const origin = hdrs.get("origin");
  if (origin) return origin;
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Returns the user's Stripe customer id, creating the customer (and saving it
 * on user_profiles) if it doesn't exist yet. Safe to call repeatedly.
 */
export async function ensureStripeCustomer(
  supabase: SupabaseClient,
  userId: string,
  email: string | null
): Promise<string> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from("user_profiles")
    .upsert(
      { id: userId, stripe_customer_id: customer.id },
      { onConflict: "id" }
    );

  return customer.id;
}

// ── createCheckoutSession ────────────────────────────────────────────────────

export async function createCheckoutSession(
  interval: BillingInterval
): Promise<CheckoutResult> {
  if (!isStripeConfigured()) {
    return { error: "Billing isn't configured yet. Please try again later." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Please sign in to upgrade." };
  }

  const priceId = priceIdFor(interval);
  if (!priceId) {
    return { error: "That plan isn't available right now." };
  }

  // Already Pro? Don't double-subscribe.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  if (profile?.plan === "pro") {
    return { error: "You're already on Pro." };
  }

  try {
    const customerId = await ensureStripeCustomer(
      supabase,
      user.id,
      user.email ?? null
    );
    const origin = getOrigin();
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
      subscription_data: { metadata: { supabase_user_id: user.id } },
      metadata: { supabase_user_id: user.id },
    });

    if (!session.url) return { error: "Couldn't start checkout." };
    return { url: session.url };
  } catch {
    return { error: "Couldn't start checkout. Please try again." };
  }
}

// ── createBillingPortalSession ───────────────────────────────────────────────

export async function createBillingPortalSession(): Promise<CheckoutResult> {
  if (!isStripeConfigured()) {
    return { error: "Billing isn't configured yet." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return { error: "No billing account found yet." };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getOrigin()}/account/billing`,
    });
    return { url: session.url };
  } catch {
    return { error: "Couldn't open the billing portal. Please try again." };
  }
}
