import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your trip",
};

interface PageProps {
  params: { id: string };
}

export default async function TripPage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defence-in-depth: middleware already gates /trip/*.
  if (!user) {
    redirect(`/login?returnTo=/trip/${params.id}`);
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("destination_name, country, destination_slug, created_at")
    .eq("id", params.id)
    .single();

  return (
    <div className="py-8">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to explore
      </Link>

      <div className="mt-4">
        <p className="text-sm font-medium text-primary-700">New trip</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {trip?.destination_name
            ? `Trip to ${trip.destination_name}`
            : "Your trip"}
        </h1>
        {trip?.country ? (
          <p className="mt-1 text-neutral-600">{trip.country}</p>
        ) : null}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
        <p className="text-neutral-600">
          Your itinerary builder for this trip is coming soon. In the meantime,
          keep{" "}
          <Link
            href="/explore"
            className="font-semibold text-primary-700 hover:text-primary-800"
          >
            exploring destinations
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
