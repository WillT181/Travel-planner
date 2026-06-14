import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Itinerary Builder",
};

export default function ItineraryPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-neutral-900">Itinerary Builder</h1>
      <p className="mt-2 text-neutral-500">
        Create a new trip — add destinations, activities, and day-by-day plans.
      </p>
    </div>
  );
}
