import { CATEGORIES, type Category } from "@/lib/budget/constants";
import type { Expense, TripBudget } from "@/types/budget";

export type CategoryStatus = "on-track" | "watch" | "over";

export interface CategorySummary {
  category: Category;
  allocation: number;
  spent: number;
  percent: number; // 0..∞ (spent / allocation)
  status: CategoryStatus;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number; // 0..∞
  daysElapsed: number;
  daysRemaining: number;
  dailyBurn: number;
  projectedSpend: number;
  perPerson: number;
  allocatedTotal: number; // sum of category allocations
  categories: CategorySummary[];
  overCategories: Category[];
  projectedOverBudget: boolean;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86_400_000);
}

function statusFor(percent: number, allocation: number): CategoryStatus {
  if (allocation <= 0) return "on-track";
  if (percent > 1) return "over";
  if (percent >= 0.8) return "watch";
  return "on-track";
}

export interface ComputeInput {
  budget: TripBudget;
  expenses: Expense[];
  travellerCount: number;
  startDate: string | null;
  endDate: string | null;
  today?: Date;
}

export function computeBudgetSummary({
  budget,
  expenses,
  travellerCount,
  startDate,
  endDate,
  today = new Date(),
}: ComputeInput): BudgetSummary {
  const totalBudget = budget.total_budget ?? 0;
  const totalSpent =
    Math.round(
      expenses.reduce((sum, e) => sum + (e.amount_gbp ?? 0), 0) * 100
    ) / 100;
  const remaining = Math.round((totalBudget - totalSpent) * 100) / 100;
  const percentUsed = totalBudget > 0 ? totalSpent / totalBudget : 0;

  // Day accounting. Falls back to the number of distinct spending days when
  // the trip has no fixed dates yet.
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  let daysElapsed: number;
  let daysRemaining: number;
  if (start) {
    const elapsed = daysBetween(start, today) + 1;
    const tripLen = end ? daysBetween(start, end) + 1 : elapsed;
    daysElapsed = Math.min(Math.max(elapsed, 1), Math.max(tripLen, 1));
    daysRemaining = end ? Math.max(daysBetween(today, end), 0) : 0;
  } else {
    const distinctDays = new Set(expenses.map((e) => e.date)).size;
    daysElapsed = Math.max(distinctDays, 1);
    daysRemaining = 0;
  }

  const dailyBurn = Math.round((totalSpent / daysElapsed) * 100) / 100;
  const projectedSpend =
    Math.round((totalSpent + dailyBurn * daysRemaining) * 100) / 100;
  const perPerson =
    travellerCount > 0
      ? Math.round((totalBudget / travellerCount) * 100) / 100
      : totalBudget;

  const spentByCategory = new Map<Category, number>();
  for (const e of expenses) {
    spentByCategory.set(
      e.category,
      (spentByCategory.get(e.category) ?? 0) + (e.amount_gbp ?? 0)
    );
  }

  const allocations = budget.category_budgets ?? {};
  let allocatedTotal = 0;
  const categories: CategorySummary[] = CATEGORIES.map((category) => {
    const allocation = allocations[category] ?? 0;
    allocatedTotal += allocation;
    const spent = Math.round((spentByCategory.get(category) ?? 0) * 100) / 100;
    const percent =
      allocation > 0 ? spent / allocation : spent > 0 ? Infinity : 0;
    return {
      category,
      allocation,
      spent,
      percent,
      status: statusFor(percent, allocation),
    };
  });

  const overCategories = categories
    .filter((c) => c.status === "over")
    .map((c) => c.category);

  const projectedOverBudget =
    totalBudget > 0 && projectedSpend > totalBudget && daysRemaining > 0;

  return {
    totalBudget,
    totalSpent,
    remaining,
    percentUsed,
    daysElapsed,
    daysRemaining,
    dailyBurn,
    projectedSpend,
    perPerson,
    allocatedTotal: Math.round(allocatedTotal * 100) / 100,
    categories,
    overCategories,
    projectedOverBudget,
  };
}

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
