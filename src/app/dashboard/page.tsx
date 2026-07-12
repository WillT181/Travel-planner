import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DESTINATIONS, getDestination } from "@/data/destinations";
import { completionScore } from "@/lib/trips/score";
import { getWeather } from "@/lib/weather/openMeteo";
import SignOutButton from "@/components/auth/SignOutButton";
import UsageBanner from "@/components/dashboard/UsageBanner";
import UpcomingTripCard from "@/components/dashboard/UpcomingTripCard";
import NewTripButton from "@/components/dashboard/NewTripButton";
import TripCard, { type TripCardData } from "@/components/dashboard/TripCard";

export const metadata: Metadata = { title: "Dashboard" };

interface PageProps {
  searchParams: { upgraded?: string };
}

interface RawTrip {
  id: string;
  destination_slug: string;
  destination_name: string | null;
  country: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  traveller_count: number | null;
  status: string;
  created_at: string;
  trip_days: { activities: { id: string }[] }[];
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end)
    return `${dateFmt.format(new Date(start))} – ${dateFmt.format(new Date(end))}`;
  return dateFmt.format(new Date((start ?? end) as string));
}

function daysUntil(start: string | null): number | null {
  if (!start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(start);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function displayStatus(trip: RawTrip): TripCardData["displayStatus"] {
  if (trip.status === "completed") return "Completed";
  const until = daysUntil(trip.start_date);
  if (until !== null && until >= 0) return "Upcoming";
  return "Planning";
}

function seedFor(slug: string): string {
  // Image lookups now key off the destination slug (see lib/images.ts).
  return slug;
}

function firstName(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim())
    return displayName.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "traveller";
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnTo=/dashboard");

  const [{ data: profile }, { data: tripRows }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("display_name, plan")
      .eq("id", user.id)
      .single(),
    supabase
      .from("trips")
      .select(
        `id, destination_slug, destination_name, country, title,
         start_date, end_date, traveller_count, status, created_at,
         trip_days ( activities ( id ) )`
      )
      .eq("user_id", user.id),
  ]);

  const trips = (tripRows ?? []) as RawTrip[];
  const isPro = profile?.plan === "pro";
  const justUpgraded = searchParams.upgraded === "true";

  // Pick the soonest trip whose start date is today or later; fall back to the
  // trip with the nearest start date, else the most recently created.
  const withStart = trips
    .filter((t) => t.start_date)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1));
  const upcomingRaw =
    withStart.find((t) => (daysUntil(t.start_date) ?? -1) >= 0) ??
    withStart[0] ??
    [...trips].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

  const weather =
    upcomingRaw && upcomingRaw.destination_name
      ? await getWeather(
          upcomingRaw.destination_name,
          upcomingRaw.country ?? ""
        )
      : null;

  const cards: TripCardData[] = trips
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((t) => ({
      id: t.id,
      destinationName: t.title || t.destination_name || "Untitled trip",
      country: t.country,
      imageSeed: seedFor(t.destination_slug),
      dateRange: formatRange(t.start_date, t.end_date),
      displayStatus: displayStatus(t),
      score: completionScore({
        title: t.title,
        start_date: t.start_date,
        end_date: t.end_date,
        traveller_count: t.traveller_count,
        trip_days: t.trip_days ?? [],
      }),
    }));

  const destinationOptions = DESTINATIONS.map((d) => ({
    slug: d.slug,
    name: d.name,
    country: d.country,
  }));

  return (
    <div className="py-8">
      {justUpgraded ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-5">
          <span className="text-2xl" aria-hidden="true">
            🎉
          </span>
          <div>
            <p className="font-bold text-primary-800">
              Welcome to Wanderly Pro!
            </p>
            <p className="mt-0.5 text-sm text-primary-700">
              Unlimited trips, budget tracking, and collaboration are now
              unlocked. Manage your plan any time from{" "}
              <Link
                href="/account/billing"
                className="font-semibold underline underline-offset-2"
              >
                billing
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      {/* Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Hi, {firstName(profile?.display_name ?? null, user.email ?? null)}{" "}
            👋
          </h1>
          <p className="mt-1 text-neutral-600">
            {trips.length === 0
              ? "Let's plan your first adventure."
              : "Here's what's coming up."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/refer"
            className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Refer a friend
          </Link>
          <Link
            href="/account"
            className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Account
          </Link>
          <SignOutButton />
        </div>
      </div>

      {/* Free-tier usage */}
      {!isPro ? (
        <div className="mt-6">
          <UsageBanner tripCount={trips.length} />
        </div>
      ) : null}

      {/* Upcoming trip */}
      {upcomingRaw ? (
        <div className="mt-6">
          <UpcomingTripCard
            trip={{
              id: upcomingRaw.id,
              destinationName:
                upcomingRaw.title ||
                upcomingRaw.destination_name ||
                "Untitled trip",
              country: upcomingRaw.country,
              imageSeed: seedFor(upcomingRaw.destination_slug),
              dateRange: formatRange(
                upcomingRaw.start_date,
                upcomingRaw.end_date
              ),
              daysUntil: daysUntil(upcomingRaw.start_date),
              score: completionScore({
                title: upcomingRaw.title,
                start_date: upcomingRaw.start_date,
                end_date: upcomingRaw.end_date,
                traveller_count: upcomingRaw.traveller_count,
                trip_days: upcomingRaw.trip_days ?? [],
              }),
            }}
            weather={weather}
          />
        </div>
      ) : null}

      {/* My trips */}
      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-neutral-900">
          My trips
        </h2>
        <NewTripButton destinations={destinationOptions} />
      </div>

      {cards.length > 0 ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
          <p className="text-neutral-600">
            You haven&apos;t started any trips yet. Browse{" "}
            <Link
              href="/explore"
              className="font-semibold text-primary-700 hover:text-primary-800"
            >
              destinations
            </Link>{" "}
            or hit <span className="font-medium">+ New trip</span> above.
          </p>
        </div>
      )}
    </div>
  );
}
