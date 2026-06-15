// Expense categories — these strings are the source of truth and must match
// the CHECK constraint in supabase/migrations/0004_budget.sql exactly.
export const CATEGORIES = [
  "Accommodation",
  "Flights",
  "Food & drink",
  "Transport",
  "Activities",
  "Shopping",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Colour dot / bar per category (hex, used in inline styles for the dots).
export const CATEGORY_COLORS: Record<Category, string> = {
  Accommodation: "#0d9488", // teal
  Flights: "#6366f1", // indigo
  "Food & drink": "#f59e0b", // amber
  Transport: "#0ea5e9", // sky
  Activities: "#ec4899", // pink
  Shopping: "#8b5cf6", // violet
  Other: "#64748b", // slate
};
