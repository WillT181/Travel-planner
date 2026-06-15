import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { buttonVariants } from "@/components/ui/Button";
import ManageBillingButton from "@/components/account/ManageBillingButton";

export const metadata: Metadata = { title: "Billing" };

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BillingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnTo=/account/billing");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan, stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro";

  // Pull the next billing date + cancellation state from Stripe when possible.
  let nextBillingDate: string | null = null;
  let cancelsAtPeriodEnd = false;
  if (isPro && isStripeConfigured() && profile?.stripe_subscription_id) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(
        profile.stripe_subscription_id
      );
      nextBillingDate = formatDate(subscription.current_period_end);
      cancelsAtPeriodEnd = subscription.cancel_at_period_end;
    } catch {
      // Non-fatal — still show the plan.
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
        Billing
      </h1>
      <p className="mt-1 text-neutral-600">{user.email}</p>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Current plan
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-neutral-900">
              {isPro ? "Pro" : "Free"}
              {isPro && (
                <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                  Active
                </span>
              )}
            </p>
          </div>
        </div>

        {isPro ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm">
              {cancelsAtPeriodEnd ? (
                <p className="text-neutral-700">
                  Your subscription is set to cancel.
                  {nextBillingDate
                    ? ` Pro access ends on ${nextBillingDate}.`
                    : ""}
                </p>
              ) : nextBillingDate ? (
                <p className="text-neutral-700">
                  Next billing date:{" "}
                  <span className="font-semibold text-neutral-900">
                    {nextBillingDate}
                  </span>
                </p>
              ) : (
                <p className="text-neutral-500">Your subscription is active.</p>
              )}
            </div>
            <ManageBillingButton />
            <p className="text-xs text-neutral-400">
              Update your card, switch between monthly and annual, download
              invoices, or cancel — all in the secure Stripe portal.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-neutral-600">
              You&apos;re on the Free plan. Upgrade to Pro for unlimited trips,
              budget tracking, and collaboration.
            </p>
            <Link
              href="/pricing"
              className={buttonVariants({
                variant: "primary",
                className: "mt-4",
              })}
            >
              Upgrade to Pro
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
