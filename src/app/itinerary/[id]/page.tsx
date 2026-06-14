import type { Metadata } from "next";

type Props = {
  params: { id: string };
};

export function generateMetadata({ params }: Props): Metadata {
  return { title: `Trip #${params.id}` };
}

export default function ItineraryDetailPage({ params }: Props) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-neutral-900">
        Trip Itinerary #{params.id}
      </h1>
      <p className="mt-2 text-neutral-500">
        View and edit the day-by-day plan for this saved trip.
      </p>
    </div>
  );
}
