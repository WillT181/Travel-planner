import type { Category } from "@/lib/budget/constants";

export interface TripBudget {
  trip_id: string;
  total_budget: number;
  currency: string;
  category_budgets: Partial<Record<Category, number>>;
}

export interface Expense {
  id: string;
  trip_id: string;
  category: Category;
  description: string;
  amount_local: number;
  currency_local: string;
  amount_gbp: number;
  date: string; // YYYY-MM-DD
  added_by_user_id: string;
  created_at: string;
}
