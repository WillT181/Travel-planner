import Link from "next/link";
import DestinationPhoto from "@/components/images/DestinationPhoto";
import { slugKeys } from "@/lib/images";
import { buttonVariants } from "@/components/ui/Button";
import type { WeatherSummary } from "@/lib/weather/openMeteo";
import ScoreRing from "./ScoreRing";
import WeatherWidget from "./WeatherWidget";

export interface UpcomingTrip {
  id: string;
  destinationName: string;
  country: string | null;
  imageSeed: string;
  dateRange: string | null;
  daysUntil: number | null;
  score: number;
}

function countdownLabel(daysUntil: number | null): string {
  if (daysUntil === null) return "Dates not set yet";
  if (daysUntil < 0) return "In progress";
  if (daysUntil === 0) return "Departing today! 🎉";
  if (daysUntil === 1) return "1 day to go";
  return `${daysUntil} days to go`;
}

export default function UpcomingTripCard({
  trip,
  weather,
}: {
  trip: UpcomingTrip;
  weather: WeatherSummary | null;
}) {
  return (
    <section
      aria-labelledby="upcoming-heading"
      className="overflow-hidden rounded-3xl border border-neutral-200 bg-white"
    >
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        {/* Image */}
        <div className="relative min-h-[200px] bg-neutral-100">
          <DestinationPhoto
            imageKeys={slugKeys(trip.imageSeed)}
            name={trip.destinationName}
            sizes="(max-width: 768px) 100vw, 55vw"
            plainFallback
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 to-transparent md:bg-gradient-to-r" />
          <div className="absolute bottom-0 left-0 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              Your next trip
            </p>
            <h2
              id="upcoming-heading"
              className="mt-1 text-2xl font-bold tracking-tight text-white"
            >
              {trip.destinationName}
            </h2>
            {trip.country ? (
              <p className="text-sm text-white/80">{trip.country}</p>
            ) : null}
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-bold tracking-tight text-primary-700">
                {countdownLabel(trip.daysUntil)}
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                {trip.dateRange ?? "Add dates to see a countdown"}
              </p>
            </div>
            <div className="text-center">
              <ScoreRing value={trip.score} />
              <p className="mt-1 text-xs text-neutral-500">Plan complete</p>
            </div>
          </div>

          <WeatherWidget weather={weather} />

          <div className="mt-auto flex gap-2">
            <Link
              href={`/trip/${trip.id}`}
              className={buttonVariants({
                variant: "primary",
                className: "flex-1",
              })}
            >
              Continue planning
            </Link>
            <Link
              href={`/trip/${trip.id}/budget`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Budget
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
