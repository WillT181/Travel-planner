"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/auth/plan";
import { CATEGORIES, type Category } from "@/lib/budget/constants";
import { computeBudgetSummary, formatGbp } from "@/lib/budget/calc";
import { buildPdf, type PdfLine } from "@/lib/budget/pdf";
import type { Expense, TripBudget } from "@/types/budget";

export interface ActionResult {
  error?: string;
}

/** Verifies the trip belongs to the signed-in Pro user; returns the user id. */
async function authorizeProTrip(
  supabase: ReturnType<typeof createClient>,
  tripId: string
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const plan = await getUserPlan(supabase);
  if (plan !== "pro") return { error: "Budget tracking is a Pro feature." };

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return { error: "Trip not found." };

  return { userId: user.id };
}

// ── setTotalBudget ───────────────────────────────────────────────────────────

export async function setTotalBudget(
  tripId: string,
  totalBudget: number,
  currency = "GBP"
): Promise<ActionResult> {
  const supabase = createClient();
  const auth = await authorizeProTrip(supabase, tripId);
  if ("error" in auth) return auth;

  const { error } = await supabase.from("trip_budget").upsert(
    {
      trip_id: tripId,
      total_budget: Math.max(0, totalBudget),
      currency,
    },
    { onConflict: "trip_id" }
  );

  if (error) return { error: "Couldn't save budget." };
  revalidatePath(`/trip/${tripId}/budget`);
  return {};
}

// ── setCategoryBudgets ───────────────────────────────────────────────────────

export async function setCategoryBudgets(
  tripId: string,
  budgets: Partial<Record<Category, number>>
): Promise<ActionResult> {
  const supabase = createClient();
  const auth = await authorizeProTrip(supabase, tripId);
  if ("error" in auth) return auth;

  // Whitelist keys to valid categories and non-negative numbers.
  const clean: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    const v = budgets[cat];
    if (typeof v === "number" && v > 0) clean[cat] = Math.round(v * 100) / 100;
  }

  const { error } = await supabase.from("trip_budget").upsert(
    {
      trip_id: tripId,
      category_budgets: clean,
    },
    { onConflict: "trip_id" }
  );

  if (error) return { error: "Couldn't save category budgets." };
  revalidatePath(`/trip/${tripId}/budget`);
  return {};
}

// ── addExpense ───────────────────────────────────────────────────────────────

export interface ExpenseInput {
  category: Category;
  description: string;
  amountLocal: number;
  currencyLocal: string;
  amountGbp: number;
  date: string;
}

export async function addExpense(
  tripId: string,
  input: ExpenseInput
): Promise<ActionResult & { expenseId?: string }> {
  const supabase = createClient();
  const auth = await authorizeProTrip(supabase, tripId);
  if ("error" in auth) return auth;

  if (!input.description.trim()) return { error: "Description is required." };
  if (!(input.amountLocal > 0)) return { error: "Amount must be positive." };
  if (!CATEGORIES.includes(input.category))
    return { error: "Invalid category." };

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      trip_id: tripId,
      category: input.category,
      description: input.description.trim(),
      amount_local: input.amountLocal,
      currency_local: input.currencyLocal,
      amount_gbp: input.amountGbp,
      date: input.date,
      added_by_user_id: auth.userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't add expense." };
  revalidatePath(`/trip/${tripId}/budget`);
  return { expenseId: data.id };
}

// ── deleteExpense ────────────────────────────────────────────────────────────

export async function deleteExpense(
  tripId: string,
  expenseId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const auth = await authorizeProTrip(supabase, tripId);
  if ("error" in auth) return auth;

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("trip_id", tripId);

  if (error) return { error: "Couldn't delete expense." };
  revalidatePath(`/trip/${tripId}/budget`);
  return {};
}

// ── exportBudgetPdf ──────────────────────────────────────────────────────────

export async function exportBudgetPdf(
  tripId: string
): Promise<ActionResult & { filename?: string; base64?: string }> {
  const supabase = createClient();
  const auth = await authorizeProTrip(supabase, tripId);
  if ("error" in auth) return auth;

  const { data: trip } = await supabase
    .from("trips")
    .select(
      "destination_name, country, title, start_date, end_date, traveller_count"
    )
    .eq("id", tripId)
    .single();

  const { data: budgetRow } = await supabase
    .from("trip_budget")
    .select("trip_id, total_budget, currency, category_budgets")
    .eq("trip_id", tripId)
    .single();

  const { data: expenseRows } = await supabase
    .from("expenses")
    .select(
      "id, trip_id, category, description, amount_local, currency_local, amount_gbp, date, added_by_user_id, created_at"
    )
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

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

  const summary = computeBudgetSummary({
    budget,
    expenses,
    travellerCount: trip?.traveller_count ?? 1,
    startDate: trip?.start_date ?? null,
    endDate: trip?.end_date ?? null,
  });

  const destination = trip?.title || trip?.destination_name || "Your trip";
  const gbp = (n: number) => formatGbp(n).replace("£", "GBP ");

  const lines: PdfLine[] = [
    { text: "Wanderly — Budget Summary", size: 20, bold: true },
    {
      text: destination + (trip?.country ? `, ${trip.country}` : ""),
      size: 12,
    },
    {
      text:
        trip?.start_date && trip?.end_date
          ? `${trip.start_date} to ${trip.end_date}  ·  ${trip.traveller_count ?? 1} traveller(s)`
          : `${trip?.traveller_count ?? 1} traveller(s)`,
      size: 10,
      gapBefore: 2,
    },
    { text: "Overview", size: 14, bold: true, gapBefore: 16 },
    { text: `Total budget:      ${gbp(summary.totalBudget)}`, size: 11 },
    { text: `Total spent:       ${gbp(summary.totalSpent)}`, size: 11 },
    { text: `Remaining:         ${gbp(summary.remaining)}`, size: 11 },
    {
      text: `Used:              ${Math.round(summary.percentUsed * 100)}%`,
      size: 11,
    },
    { text: `Daily burn rate:   ${gbp(summary.dailyBurn)}`, size: 11 },
    { text: `Per person:        ${gbp(summary.perPerson)}`, size: 11 },
    {
      text: `Projected spend:   ${gbp(summary.projectedSpend)}`,
      size: 11,
    },
    { text: "By category", size: 14, bold: true, gapBefore: 16 },
    ...summary.categories.map((c) => ({
      text: `${c.category.padEnd(16)} ${gbp(c.spent)} spent of ${gbp(c.allocation)} budget`,
      size: 11,
    })),
    { text: "Expenses", size: 14, bold: true, gapBefore: 16 },
    ...(expenses.length
      ? expenses.map((e) => ({
          text: `${e.date}  ${e.category.padEnd(16)} ${e.description}  —  ${gbp(e.amount_gbp)}`,
          size: 10,
        }))
      : [{ text: "No expenses logged yet.", size: 10 }]),
    {
      text: `Generated ${new Date().toISOString().slice(0, 10)} by Wanderly`,
      size: 9,
      gapBefore: 20,
    },
  ];

  const base64 = buildPdf(lines);
  const safeName = destination.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { filename: `budget-${safeName}.pdf`, base64 };
}
