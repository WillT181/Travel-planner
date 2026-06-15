import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="mt-0.5 h-5 w-5 shrink-0 text-primary-600"
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

// Benefits pulled from the actual Pro feature set referenced across the app
// (LockedItineraryCard, UpgradeCta): full multi-day itineraries / unlimited
// trips, the budget tracker itself, and collaborative + offline planning.
const BENEFITS = [
  {
    title: "Live budget tracking in any currency",
    body: "Log expenses on the go with automatic FX conversion to GBP, per-category limits, burn-rate alerts, and PDF export.",
  },
  {
    title: "Unlimited trips and days",
    body: "Go past the free 3-trip / 5-day caps and plan as far ahead as you like.",
  },
  {
    title: "Full 7-day itineraries, offline maps & collaboration",
    body: "Unlock the complete day-by-day plans and invite travel companions to plan together.",
  },
];

export default function UpgradePrompt({
  destinationName,
}: {
  destinationName: string;
}) {
  return (
    <div className="mx-auto max-w-2xl py-12 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Pro feature
      </span>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        Track your {destinationName} budget with Pro
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-lg text-neutral-600">
        The Budget Tracker keeps your spending on plan — set limits, log
        expenses in any currency, and see exactly where the money goes.
      </p>

      <ul className="mx-auto mt-8 max-w-md space-y-4 text-left">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-3">
            <CheckIcon />
            <div>
              <p className="font-semibold text-neutral-900">{b.title}</p>
              <p className="text-sm text-neutral-600">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/pricing"
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          Upgrade to Pro
        </Link>
        <Link
          href="."
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Back to itinerary
        </Link>
      </div>
    </div>
  );
}
