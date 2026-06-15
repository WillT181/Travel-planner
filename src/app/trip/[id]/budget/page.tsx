import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/auth/plan";
import TripTabs from "@/components/trip/TripTabs";
import UpgradePrompt from "@/components/budget/UpgradePrompt";
import BudgetDashboard from "@/components/budget/BudgetDashboard";
import type { TripBudget, Expense } from "@/types/budget";

export const metadata: Metadata = { title: "Budget tracker" };

interface PageProps {
  params: { id: string };
}

export default async function BudgetPage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=/trip/${params.id}/budget`);
  }

  // Fetch trip to confirm ownership and get metadata
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, destination_name, country, title, start_date, end_date, traveller_count"
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const plan = await getUserPlan(supabase);
  const isPro = plan === "pro";

  const destinationName =
    trip.title ?? trip.destination_name ?? "your destination";

  return (
    <div className="py-6">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to explore
      </Link>

      {/* Shared tab bar with itinerary page */}
      <TripTabs tripId={params.id} isPro={isPro} />

      {!isPro ? (
        <UpgradePrompt destinationName={destinationName} />
      ) : (
        <BudgetContent tripId={params.id} trip={trip} />
      )}
    </div>
  );
}

// Separate async component so Pro-only data fetching is skipped for free users.
async function BudgetContent({
  tripId,
  trip,
}: {
  tripId: string;
  trip: {
    destination_name: string | null;
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    traveller_count: number | null;
  };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: budgetRow }, { data: expenseRows }, { data: profile }] =
    await Promise.all([
      supabase
        .from("trip_budget")
        .select("trip_id, total_budget, currency, category_budgets")
        .eq("trip_id", tripId)
        .single(),
      supabase
        .from("expenses")
        .select(
          "id, trip_id, category, description, amount_local, currency_local, amount_gbp, date, added_by_user_id, created_at"
        )
        .eq("trip_id", tripId)
        .order("date", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("currency")
        .eq("id", user?.id ?? "")
        .single(),
    ]);

  const budget: TripBudget = budgetRow
    ? {
        trip_id: budgetRow.trip_id,
        total_budget: Number(budgetRow.total_budget),
        currency: budgetRow.currency,
        category_budgets: budgetRow.category_budgets ?? {},
      }
    : {
        trip_id: tripId,
        total_budget: 0,
        currency: "GBP",
        category_budgets: {},
      };

  const expenses = (expenseRows ?? []) as Expense[];

  return (
    <div className="mt-6">
      <BudgetDashboard
        tripId={tripId}
        destinationName={
          trip.title ?? trip.destination_name ?? "your destination"
        }
        travellerCount={trip.traveller_count ?? 1}
        startDate={trip.start_date ?? null}
        endDate={trip.end_date ?? null}
        budget={budget}
        expenses={expenses}
        defaultCurrency={profile?.currency ?? "GBP"}
      />
    </div>
  );
}
