"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { PRICING, type BillingInterval } from "@/lib/stripe/config";

const FREE_FEATURES = [
  "Up to 3 saved trips",
  "Up to 5 days per trip",
  "Day-by-day itinerary builder",
  "16 curated destinations with sample plans",
  "Destination search powered by Google Places",
  "Trips saved securely to your account",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited trips and days",
  "Full 7-day curated itineraries for every destination",
  "Budget tracker with multi-currency expenses & live FX",
  "Per-category budgets, burn-rate alerts & PDF export",
  "Invite collaborators as editors or viewers",
  "Real-time collaborative planning",
  "Offline maps for trips on the move",
  "Priority support",
  "Early access to new features",
];

function Check({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`mt-0.5 h-5 w-5 shrink-0 ${muted ? "text-neutral-400" : "text-primary-600"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function PricingPlans({
  isLoggedIn,
  isPro,
}: {
  isLoggedIn: boolean;
  isPro: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpgrade() {
    setError(null);
    startTransition(async () => {
      const result = await createCheckoutSession(interval);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError(result.error ?? "Something went wrong.");
    });
  }

  const proPrice = interval === "annual" ? PRICING.annual : PRICING.monthly;

  return (
    <div>
      {/* Billing interval toggle */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${interval === "monthly" ? "text-neutral-900" : "text-neutral-400"}`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={interval === "annual"}
          aria-label="Toggle annual billing"
          onClick={() =>
            setInterval((i) => (i === "monthly" ? "annual" : "monthly"))
          }
          className="relative h-7 w-12 rounded-full bg-neutral-200 transition-colors data-[on=true]:bg-primary-600"
          data-on={interval === "annual"}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              interval === "annual" ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${interval === "annual" ? "text-neutral-900" : "text-neutral-400"}`}
        >
          Annual
        </span>
        <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
          Save {PRICING.annual.savePercent}%
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* ── Free ──────────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-8">
          <h2 className="text-lg font-bold text-neutral-900">Free</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Everything you need to plan your first trips.
          </p>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight text-neutral-900">
              £0
            </span>
            <span className="text-neutral-500">/month</span>
          </p>

          <div className="mt-6">
            {!isLoggedIn ? (
              <Link
                href="/signup?returnTo=/pricing"
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                  className: "w-full",
                })}
              >
                Start free
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                  className: "w-full cursor-default opacity-60",
                })}
              >
                {isPro ? "Included with Pro" : "Your current plan"}
              </button>
            )}
          </div>

          <ul className="mt-8 space-y-3">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-3 text-sm text-neutral-700">
                <Check muted />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Pro ───────────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl border-2 border-primary-600 bg-white p-8 shadow-lg">
          <span className="absolute -top-3 left-8 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
            Most popular
          </span>

          <h2 className="text-lg font-bold text-neutral-900">Pro</h2>
          <p className="mt-1 text-sm text-neutral-500">
            For serious trip-planners and groups.
          </p>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight text-neutral-900">
              {proPrice.label}
            </span>
            <span className="text-neutral-500">{proPrice.suffix}</span>
          </p>
          {interval === "annual" ? (
            <p className="mt-1 text-sm text-primary-700">
              Just {PRICING.annual.perMonth}/month, billed yearly
            </p>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">
              or {PRICING.annual.label}/year (save {PRICING.annual.savePercent}
              %)
            </p>
          )}

          <div className="mt-6">
            {isPro ? (
              <Link
                href="/account/billing"
                className={buttonVariants({
                  variant: "primary",
                  size: "lg",
                  className: "w-full",
                })}
              >
                Manage your plan
              </Link>
            ) : !isLoggedIn ? (
              <Link
                href="/signup?returnTo=/pricing"
                className={buttonVariants({
                  variant: "primary",
                  size: "lg",
                  className: "w-full",
                })}
              >
                Start free
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={isPending}
                className={buttonVariants({
                  variant: "primary",
                  size: "lg",
                  className: "w-full",
                })}
              >
                {isPending ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            )}
            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <ul className="mt-8 space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex gap-3 text-sm text-neutral-700">
                <Check />
                {f}
              </li>
            ))}
          </ul>

          {/* Testimonial */}
          <figure className="mt-8 rounded-2xl bg-primary-50 p-5">
            <blockquote className="text-sm leading-relaxed text-neutral-700">
              “Wanderly Pro turned our chaotic group chat into one shared plan.
              The budget tracker alone saved us from three arguments — we could
              all see exactly what we were spending in euros and pounds.”
            </blockquote>
            <figcaption className="mt-3 text-sm font-semibold text-neutral-900">
              Maya R.
              <span className="font-normal text-neutral-500">
                {" "}
                · planned 6 trips with Wanderly
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
