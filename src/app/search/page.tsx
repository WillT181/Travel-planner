import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Destinations",
};

export default function SearchPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-neutral-900">
        Search Destinations
      </h1>
      <p className="mt-2 text-neutral-500">
        Find your next destination — search by city, country, or interest.
      </p>
    </div>
  );
}
