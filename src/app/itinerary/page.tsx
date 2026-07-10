import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import StartTripForm from "@/components/itinerary/StartTripForm";

export const metadata: Metadata = {
  title: "Plan a trip",
  description:
    "Build a free day-by-day trip itinerary — pick a destination, set your dates, and start planning. No account needed.",
};

export default async function ItineraryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="py-8">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-12 lg:grid-cols-2">
        <header>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary-600">
            Itinerary builder
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Start a trip
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            Pick a destination, add your dates, and build a day-by-day plan with
            activities, notes, and a running budget.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-neutral-600">
            {[
              "Morning, afternoon and evening slots for every day",
              "Drag to reorder activities as plans change",
              "Live cost total as you add activities",
              "Free to use — no account needed to start",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-0.5 text-primary-600">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </header>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <StartTripForm isAuthed={Boolean(user)} />
        </div>
      </div>
    </div>
  );
}
