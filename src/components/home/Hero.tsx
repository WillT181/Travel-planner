import DestinationSearch from "@/components/DestinationSearch";

const TRUST_BADGES = [
  "100k+ trips planned",
  "Free to start",
  "No credit card needed",
] as const;

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 text-primary-600"
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

/** Decorative dotted world-map silhouette used as a soft background accent. */
function WorldMapAccent() {
  return (
    <svg
      className="absolute inset-0 h-full w-full text-primary-200/50"
      viewBox="0 0 1200 500"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="map-dots"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="2" fill="currentColor" />
        </pattern>
      </defs>
      {/* Loose continent blobs filled with the dot pattern */}
      <path
        d="M120 180 Q180 120 280 140 Q360 150 380 220 Q360 300 280 320 Q180 330 130 280 Q90 230 120 180Z"
        fill="url(#map-dots)"
      />
      <path
        d="M520 120 Q620 90 700 130 Q760 170 740 250 Q700 330 600 340 Q520 330 500 250 Q490 170 520 120Z"
        fill="url(#map-dots)"
      />
      <path
        d="M860 160 Q960 130 1050 170 Q1110 210 1080 290 Q1020 360 920 350 Q850 330 840 250 Q835 200 860 160Z"
        fill="url(#map-dots)"
      />
    </svg>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-b from-primary-50 to-white px-6 py-16 sm:px-10 sm:py-20 lg:py-24">
      <WorldMapAccent />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-1.5 text-sm font-medium text-primary-700">
          <span className="h-2 w-2 rounded-full bg-accent-500" />
          Your all-in-one trip planner
        </span>

        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          Plan your perfect trip, stress-free
        </h1>

        <p className="mt-5 max-w-xl text-lg text-neutral-600">
          Search any destination, build a day-by-day itinerary in minutes, and
          keep every booking, idea, and map pin in one organised place.
        </p>

        <div className="mt-8 w-full max-w-xl">
          <DestinationSearch placeholder="Where to? Try “Lisbon” or “Japan”" />
        </div>

        <ul
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          aria-label="Why travellers choose us"
        >
          {TRUST_BADGES.map((badge) => (
            <li
              key={badge}
              className="flex items-center gap-1.5 text-sm font-medium text-neutral-600"
            >
              <CheckIcon />
              {badge}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
