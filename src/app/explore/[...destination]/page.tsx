import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  DESTINATIONS,
  getDestination,
  destinationImage,
} from "@/data/destinations";
import {
  resolveCatalogDestination,
  type CatalogDestination,
} from "@/lib/destinations/catalog";
import { resolveLocalCity } from "@/lib/destinations/local";
import ItineraryTimeline from "@/components/explore/ItineraryTimeline";
import LockedItineraryCard from "@/components/explore/LockedItineraryCard";
import StartPlanningButton from "@/components/explore/StartPlanningButton";

interface PageProps {
  params: { destination: string[] };
}

/**
 * Resolve a generated slug to a destination: curated major countries/cities
 * first, then the full city dataset (cities.full.json) for the long tail.
 */
function resolvePlace(slug: string): CatalogDestination | null {
  return resolveCatalogDestination(slug) ?? resolveLocalCity(slug);
}

/** Pre-render the curated seed guides; everything else renders on demand. */
export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ destination: [d.slug] }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const slug = params.destination.join("/");

  const seed = getDestination(slug);
  if (seed) {
    return {
      title: `${seed.name} Travel Guide — ${seed.country}`,
      description: `Plan your trip to ${seed.name}. ${seed.summary} Best time to visit: ${seed.bestTimeToVisit}.`,
      openGraph: {
        title: `${seed.name} Travel Guide`,
        description: seed.summary,
        type: "website",
        images: [destinationImage(seed.imageSeed, 1200, 630)],
      },
    };
  }

  const place = resolvePlace(slug);
  if (place) {
    const where =
      place.kind === "city" ? `${place.name}, ${place.country}` : place.name;
    return {
      title: `${place.name} Travel Guide${place.kind === "city" ? ` — ${place.country}` : ""}`,
      description: `Plan your trip to ${where}. Build a day-by-day itinerary, track your budget, and keep everything in one place.`,
      openGraph: {
        title: `${place.name} Travel Guide`,
        type: "website",
        images: [
          `https://picsum.photos/seed/${encodeURIComponent(slug)}/1200/630`,
        ],
      },
    };
  }

  return { title: "Destination not found" };
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}

export default function DestinationPage({ params }: PageProps) {
  const slug = params.destination.join("/");

  const seed = getDestination(slug);
  if (seed) return <SeedDestination slug={slug} />;

  const place = resolvePlace(slug);
  if (place) return <GeneratedDestination place={place} slug={slug} />;

  notFound();
}

// ── Seed (curated) destination — the rich, hand-written guide ────────────────

function SeedDestination({ slug }: { slug: string }) {
  const destination = getDestination(slug);
  if (!destination) notFound();

  return (
    <div className="py-8">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to explore
      </Link>

      {/* Hero */}
      <div className="relative mt-4 aspect-[21/9] w-full overflow-hidden rounded-3xl bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={destinationImage(destination.imageSeed, 1600, 700)}
          alt={`${destination.name}, ${destination.country}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <p className="text-sm font-medium text-white/80">
            {destination.country}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            {destination.name}
          </h1>
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-lg text-neutral-700">
        {destination.summary}
      </p>

      {/* Quick facts */}
      <section className="mt-8" aria-labelledby="quick-facts-heading">
        <h2
          id="quick-facts-heading"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-500"
        >
          Quick facts
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickFact
            label="Best months"
            value={destination.quickFacts.bestMonths}
          />
          <QuickFact
            label="Avg budget / day"
            value={destination.quickFacts.avgBudgetPerDay}
          />
          <QuickFact label="Language" value={destination.quickFacts.language} />
          <QuickFact label="Currency" value={destination.quickFacts.currency} />
        </dl>
      </section>

      {/* Sample itinerary + locked card */}
      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="itinerary-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="itinerary-heading"
              className="text-2xl font-bold tracking-tight text-neutral-900"
            >
              Your 3-day sample itinerary
            </h2>
            <span className="shrink-0 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
              Free teaser
            </span>
          </div>
          <p className="mt-2 text-neutral-600">
            A taste of {destination.name} to get you started.
          </p>

          <div className="mt-6">
            <ItineraryTimeline days={destination.sampleItinerary} />
          </div>
        </section>

        <aside className="lg:pt-1">
          <LockedItineraryCard
            destinationSlug={destination.slug}
            destinationName={destination.name}
          />
        </aside>
      </div>

      {/* Start planning CTA */}
      <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">
            Ready to make it real?
          </h2>
          <p className="mt-1 text-neutral-600">
            Start a trip to {destination.name} and build your own day-by-day
            plan.
          </p>
        </div>
        <StartPlanningButton slug={destination.slug} />
      </div>
    </div>
  );
}

// ── Generated destination — country / major city from the bundled catalog ────

function GeneratedDestination({
  place,
  slug,
}: {
  place: CatalogDestination;
  slug: string;
}) {
  const heroImage = `https://picsum.photos/seed/${encodeURIComponent(slug)}/1600/700`;
  const currency = place.currency
    ? `${place.currency}${place.currencySymbol ? ` (${place.currencySymbol})` : ""}`
    : "—";

  return (
    <div className="py-8">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to explore
      </Link>

      {/* Hero */}
      <div className="relative mt-4 aspect-[21/9] w-full overflow-hidden rounded-3xl bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt={`${place.name}${place.kind === "city" ? `, ${place.country}` : ""}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-white/80">
            {place.flag ? (
              <span aria-hidden="true" className="text-lg">
                {place.flag}
              </span>
            ) : null}
            {place.kind === "city" ? place.country : place.region}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            {place.name}
          </h1>
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-lg text-neutral-700">
        {place.kind === "city"
          ? `${place.name} is ${place.isCapital ? "the capital city" : "a city"} in ${place.country}. Start planning your trip and build a day-by-day itinerary.`
          : `${place.name} is a country in ${place.region}. Pick a city to dive into, or start planning your trip now.`}
      </p>

      {/* Quick facts */}
      <section className="mt-8" aria-labelledby="quick-facts-heading">
        <h2
          id="quick-facts-heading"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-500"
        >
          Quick facts
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickFact
            label="Type"
            value={
              place.kind === "city"
                ? place.isCapital
                  ? "Capital city"
                  : "City"
                : "Country"
            }
          />
          <QuickFact label="Region" value={place.region || "—"} />
          <QuickFact
            label={place.kind === "city" ? "Country" : "Capital"}
            value={place.kind === "city" ? place.country : place.capital ?? "—"}
          />
          <QuickFact label="Currency" value={currency} />
        </dl>
      </section>

      {/* Start planning CTA */}
      <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">
            Ready to make it real?
          </h2>
          <p className="mt-1 text-neutral-600">
            Start a trip to {place.name} and build your own day-by-day plan.
          </p>
        </div>
        <StartPlanningButton slug={slug} />
      </div>
    </div>
  );
}
