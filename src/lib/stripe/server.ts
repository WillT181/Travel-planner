import Stripe from "stripe";

/**
 * Lazily-instantiated server-side Stripe client. Reads STRIPE_SECRET_KEY at
 * call time so the module can be imported during build without the key set.
 * Throws a clear error if billing is used while unconfigured.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — billing is not configured."
    );
  }
  cached = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
