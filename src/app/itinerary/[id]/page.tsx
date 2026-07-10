import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/auth/plan";
import ItineraryBuilder from "@/components/itinerary/ItineraryBuilder";
import LocalTripGate from "@/components/itinerary/LocalTripGate";
import { isLocalTripId, type BuilderTrip } from "@/lib/itinerary/types";
import type { TimeOfDay } from "@/types/trip";

type Props = {
  params: { id: string };
};

export const metadata: Metadata = {
  title: "Itinerary builder",
};

interface DbActivity {
  id: string;
  time_of_day: TimeOfDay;
  title: string;
  notes: string | null;
  cost: number | null;
  sort_order: number;
}

interface DbDay {
  id: string;
  day_number: number;
  date: string | null;
  activities: DbActivity[];
}

export default async function ItineraryBuilderPage({ params }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous trips live in localStorage — the gate loads them client-side
  // (and imports them into the account if the visitor has since signed up).
  if (isLocalTripId(params.id)) {
    return (
      <div className="py-8">
        <LocalTripGate tripId={params.id} isAuthed={Boolean(user)} />
      </div>
    );
  }

  if (!user) {
    redirect(`/login?returnTo=/itinerary/${params.id}`);
  }

  const { data: trip } = await supabase
    .from("trips")
    .select(
      `
      id, title, destination_slug, destination_name, country,
      start_date, end_date, traveller_count,
      trip_days (
        id, day_number, date,
        activities ( id, time_of_day, title, notes, cost, sort_order )
      )
    `
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const days = ((trip.trip_days ?? []) as DbDay[])
    .slice()
    .sort((a, b) => a.day_number - b.day_number);

  const initialTrip: BuilderTrip = {
    id: trip.id,
    title:
      trip.title ?? `Trip to ${trip.destination_name ?? trip.destination_slug}`,
    destinationName: trip.destination_name ?? trip.destination_slug,
    destinationSlug: trip.destination_slug,
    country: trip.country,
    startDate: trip.start_date,
    endDate: trip.end_date,
    travellerCount: trip.traveller_count ?? 1,
    days: days.map((d) => ({
      id: d.id,
      dayNumber: d.day_number,
      date: d.date,
      activities: (d.activities ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((a) => ({
          id: a.id,
          timeOfDay: a.time_of_day,
          title: a.title,
          notes: a.notes,
          cost: a.cost != null ? Number(a.cost) : null,
          sortOrder: a.sort_order,
        })),
    })),
  };

  const isPro = (await getUserPlan(supabase)) === "pro";

  return (
    <div className="py-8">
      <ItineraryBuilder
        initialTrip={initialTrip}
        mode="remote"
        isPro={isPro}
        isAuthed
      />
    </div>
  );
}
