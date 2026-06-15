import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export default function UpgradeCta() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="upgrade-heading">
      <div className="relative overflow-hidden rounded-3xl bg-primary-700 px-6 py-14 text-center sm:px-12">
        {/* Soft accent glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-primary-400/30 blur-3xl"
        />

        <div className="relative mx-auto max-w-2xl">
          <h2
            id="upgrade-heading"
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Ready to travel smarter? Upgrade to Pro
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Unlock unlimited trips, collaborative planning, offline maps, and
            priority support — everything you need for the big adventures.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className={buttonVariants({
                variant: "primary",
                size: "lg",
                className:
                  "bg-accent-500 hover:bg-accent-600 focus-visible:ring-accent-400 focus-visible:ring-offset-primary-700",
              })}
            >
              Upgrade to Pro
            </Link>
            <Link
              href="/itinerary"
              className="text-sm font-semibold text-primary-100 underline-offset-4 hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700 rounded"
            >
              Or start free →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
