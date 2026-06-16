import type { Metadata } from "next";
import ExploreBrowser from "@/components/explore/ExploreBrowser";
import DestinationSearch from "@/components/DestinationSearch";
import { DESTINATIONS } from "@/data/destinations";

export const metadata: Metadata = {
  title: "Explore destinations",
  description:
    "Browse hand-picked destinations by mood — beach, city, adventure, culture, or budget — and find your next trip.",
};

export default function ExplorePage() {
  return (
    <div className="py-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Explore destinations
        </h1>
        <p className="mt-3 text-lg text-neutral-600">
          Search any city or country, or browse our hand-picked guides by the
          kind of trip you&apos;re dreaming of.
        </p>
        <div className="mt-6">
          <DestinationSearch placeholder="Search any city or country…" />
        </div>
      </header>

      <ExploreBrowser destinations={DESTINATIONS} />
    </div>
  );
}
