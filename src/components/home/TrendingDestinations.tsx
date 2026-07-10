import Link from "next/link";

interface Destination {
  name: string;
  country: string;
  /** picsum seed → stable placeholder image. */
  seed: string;
  /** Canonical /explore/{slug} path segment (seed guide or catalog slug). */
  slug: string;
}

const DESTINATIONS: Destination[] = [
  { name: "Lisbon", country: "Portugal", seed: "lisbon", slug: "lisbon" },
  { name: "Tokyo", country: "Japan", seed: "tokyo", slug: "japan/tokyo" },
  { name: "Bali", country: "Indonesia", seed: "bali", slug: "bali" },
  { name: "Marrakech", country: "Morocco", seed: "morocco", slug: "marrakech" },
  { name: "Reykjavík", country: "Iceland", seed: "iceland", slug: "reykjavik" },
  {
    name: "New York",
    country: "United States",
    seed: "newyork",
    slug: "united-states/new-york-city",
  },
  { name: "Bangkok", country: "Thailand", seed: "thailand", slug: "bangkok" },
  {
    name: "Amalfi Coast",
    country: "Italy",
    seed: "amalfi",
    slug: "amalfi-coast",
  },
];

function ArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default function TrendingDestinations() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="trending-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="trending-heading"
            className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl"
          >
            Trending destinations
          </h2>
          <p className="mt-3 text-lg text-neutral-600">
            Where travellers are heading this season.
          </p>
        </div>
        <Link
          href="/explore"
          className="text-sm font-semibold text-primary-700 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          Browse all destinations →
        </Link>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {DESTINATIONS.map((dest) => (
          <li key={dest.seed}>
            <Link
              href={`/explore/${dest.slug}`}
              className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://picsum.photos/seed/${dest.seed}/600/450`}
                  alt={`${dest.name}, ${dest.country}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-neutral-900">
                    {dest.name}
                  </h3>
                  <p className="truncate text-sm text-neutral-500">
                    {dest.country}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700">
                  Explore
                  <ArrowIcon />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
