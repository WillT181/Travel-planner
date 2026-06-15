/**
 * Stripe pricing config — single source of truth for the UI and server.
 *
 * Price IDs come from your Stripe dashboard (create a Pro product with a
 * monthly and an annual recurring price), exposed via env so the same code
 * works across test/live modes.
 */
export type BillingInterval = "monthly" | "annual";

export const PRICING = {
  monthly: {
    amount: 7,
    label: "£7",
    suffix: "/month",
    priceEnv: "STRIPE_PRICE_MONTHLY",
  },
  annual: {
    amount: 59,
    label: "£59",
    suffix: "/year",
    priceEnv: "STRIPE_PRICE_ANNUAL",
    // £7 × 12 = £84; £59 is ~30% off.
    perMonth: "£4.92",
    savePercent: 30,
  },
} as const;

export function priceIdFor(interval: BillingInterval): string | undefined {
  return interval === "annual"
    ? process.env.STRIPE_PRICE_ANNUAL
    : process.env.STRIPE_PRICE_MONTHLY;
}
