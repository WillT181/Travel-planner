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
import { getCityInfo, type CityInfo } from "@/lib/destinations/cityInfo";
import {
  getWeatherByCoords,
  type WeatherSummary,
} from "@/lib/weather/openMeteo";
import ItineraryTimeline from "@/components/explore/ItineraryTimeline";
import LockedItineraryCard from "@/components/explore/LockedItineraryCard";
import StartPlanningButton from "@/components/explore/StartPlanningButton";
import HeroSearch from "@/components/home/HeroSearch";

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

const BASE_URL = "https://wanderly.travel";

export function generateMetadata({ params }: PageProps): Metadata {
  const slug = params.destination.join("/");
  const canonical = `${BASE_URL}/explore/${slug}`;

  const seed = getDestination(slug);
  if (seed) {
    return {
      title: `${seed.name} Travel Guide — ${seed.country}`,
      description: `Plan your trip to ${seed.name}. ${seed.summary} Best time to visit: ${seed.bestTimeToVisit}.`,
      alternates: { canonical },
      openGraph: {
        title: `${seed.name} Travel Guide`,
        description: seed.summary,
        type: "website",
        url: canonical,
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
      alternates: { canonical },
      openGraph: {
        title: `${place.name} Travel Guide`,
        type: "website",
        url: canonical,
        images: [
          `https://picsum.photos/seed/${encodeURIComponent(slug)}/1200/630`,
        ],
      },
    };
  }

  // Unknown destination — friendly search state; keep it out of the index.
  return { title: "Destination not found", robots: { index: false } };
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

export default async function DestinationPage({ params }: PageProps) {
  const slug = params.destination.join("/");

  const seed = getDestination(slug);
  if (seed) return <SeedDestination slug={slug} />;

  const place = resolvePlace(slug);
  if (place) return <GeneratedDestination place={place} slug={slug} />;

  return <DestinationNotFound slug={slug} />;
}

// ── Unknown slug — friendly search state instead of a bare 404 ───────────────

function DestinationNotFound({ slug }: { slug: string }) {
  const pretty = decodeURIComponent(slug).replace(/[-/]+/g, " ").trim();

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-5xl" aria-hidden="true">
        🧭
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
        We couldn&apos;t find &ldquo;{pretty}&rdquo;
      </h1>
      <p className="mt-3 text-lg text-neutral-600">
        That destination isn&apos;t in our atlas (yet). Try searching for a city
        or country below, or browse everywhere we cover.
      </p>

      <div className="mt-8 text-left">
        <HeroSearch />
      </div>

      <Link
        href="/explore"
        className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-900"
      >
        Browse all destinations →
      </Link>
    </div>
  );
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

async function GeneratedDestination({
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

  // For cities, enrich with live geocoding facts + current weather (both
  // best-effort; the page renders fine if either is unavailable).
  const info =
    place.kind === "city"
      ? await getCityInfo(place.name, place.countryId)
      : null;
  const weather = info
    ? await getWeatherByCoords(
        info.latitude,
        info.longitude,
        place.name,
        place.country
      )
    : null;

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

      {/* Live city info (weather + geocoded facts) */}
      {place.kind === "city" && (info || weather) ? (
        <section className="mt-10" aria-labelledby="about-heading">
          <h2
            id="about-heading"
            className="text-2xl font-bold tracking-tight text-neutral-900"
          >
            About {place.name}
          </h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            {weather ? <WeatherPanel weather={weather} /> : null}

            {info ? (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {info.population != null ? (
                  <QuickFact
                    label="Population"
                    value={formatNumber(info.population)}
                  />
                ) : null}
                {info.region ? (
                  <QuickFact label="Region" value={info.region} />
                ) : null}
                {info.timezone ? (
                  <QuickFact
                    label="Timezone"
                    value={info.timezone.replace(/_/g, " ")}
                  />
                ) : null}
                {info.timezone ? (
                  <QuickFact
                    label="Local time"
                    value={localTime(info.timezone)}
                  />
                ) : null}
                {info.elevation != null ? (
                  <QuickFact
                    label="Elevation"
                    value={`${formatNumber(Math.round(info.elevation))} m`}
                  />
                ) : null}
                <QuickFact
                  label="Coordinates"
                  value={`${info.latitude.toFixed(2)}, ${info.longitude.toFixed(2)}`}
                />
              </dl>
            ) : null}
          </div>

          {info ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${info.latitude}&mlon=${info.longitude}#map=11/${info.latitude}/${info.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View on map ↗
            </a>
          ) : null}
        </section>
      ) : null}

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

// ── Helpers for the live city-info section ───────────────────────────────────

function WeatherPanel({ weather }: { weather: WeatherSummary }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-primary-100 bg-primary-50 p-5">
      <span className="text-5xl leading-none" aria-hidden="true">
        {weather.emoji}
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary-700">
          Current weather
        </p>
        <p className="mt-0.5 text-2xl font-bold text-neutral-900">
          {weather.temperature}°C
        </p>
        <p className="text-sm text-neutral-600">
          {weather.description} · H {weather.high}° / L {weather.low}°
        </p>
      </div>
    </div>
  );
}

/** Thousands-separated integer, e.g. 1234567 → "1,234,567". */
function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Current wall-clock time in the given IANA timezone, e.g. "14:32". */
function localTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return "—";
  }
}
