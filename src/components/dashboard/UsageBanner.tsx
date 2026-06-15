import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

const FREE_MAX_TRIPS = 3;

/** Subtle banner shown to free users: trips used out of the free allowance. */
export default function UsageBanner({ tripCount }: { tripCount: number }) {
  const used = Math.min(tripCount, FREE_MAX_TRIPS);
  const atLimit = tripCount >= FREE_MAX_TRIPS;
  const pct = Math.min(100, (tripCount / FREE_MAX_TRIPS) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-neutral-700">
            {atLimit ? (
              <>You&apos;ve used all {FREE_MAX_TRIPS} free trips</>
            ) : (
              <>
                {used} of {FREE_MAX_TRIPS} free trips used
              </>
            )}
          </p>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-valuenow={tripCount}
          aria-valuemin={0}
          aria-valuemax={FREE_MAX_TRIPS}
          aria-label="Free trips used"
        >
          <div
            className={`h-full rounded-full ${atLimit ? "bg-accent-500" : "bg-primary-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Link
        href="/pricing"
        className={buttonVariants({
          variant: atLimit ? "primary" : "secondary",
          size: "sm",
          className: "shrink-0",
        })}
      >
        {atLimit ? "Upgrade for unlimited" : "Go Pro"}
      </Link>
    </div>
  );
}
