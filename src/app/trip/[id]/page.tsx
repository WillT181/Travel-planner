import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TripPlanner from "@/components/trip/TripPlanner";
import TripTabs from "@/components/trip/TripTabs";
import { getUserPlan } from "@/lib/auth/plan";
import type { Trip } from "@/types/trip";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("trips")
    .select("destination_name")
    .eq("id", params.id)
    .single();
  return {
    title: data?.destination_name
      ? `Trip to ${data.destination_name}`
      : "Your trip",
  };
}

export default async function TripPage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=/trip/${params.id}`);
  }

  const [{ data: raw }, plan] = await Promise.all([
    supabase
      .from("trips")
      .select(
        `
      id, user_id, destination_slug, destination_name, country,
      title, start_date, end_date, traveller_count, status, created_at,
      trip_days (
        id, trip_id, day_number, date, label, created_at,
        activities (
          id, trip_day_id, time_of_day, title, notes,
          duration_mins, cost, sort_order, created_at
        )
      )
    `
      )
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single(),
    getUserPlan(supabase),
  ]);

  if (!raw) notFound();

  const trip: Trip = {
    ...raw,
    status: (raw.status ?? "planning") as Trip["status"],
    trip_days: ((raw.trip_days as Trip["trip_days"]) ?? [])
      .sort((a, b) => a.day_number - b.day_number)
      .map((day) => ({
        ...day,
        activities: (day.activities ?? []).sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.created_at.localeCompare(b.created_at)
        ),
      })),
  };

  return (
    <div className="py-6">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to explore
      </Link>

      <TripTabs tripId={params.id} isPro={plan === "pro"} />

      <div className="mt-6">
        <TripPlanner trip={trip} />
      </div>
    </div>
  );
}
