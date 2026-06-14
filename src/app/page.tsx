import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
        Your next adventure starts here
      </h1>
      <p className="mt-4 max-w-xl text-lg text-neutral-500">
        Search destinations, build day-by-day itineraries, and keep all your
        travel plans organised in one place.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/search"
          className="rounded-md bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          Explore destinations
        </Link>
        <Link
          href="/itinerary"
          className="rounded-md bg-accent-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          Plan a trip
        </Link>
      </div>
    </div>
  );
}
