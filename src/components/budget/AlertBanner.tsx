import type { BudgetSummary } from "@/lib/budget/calc";
import { formatGbp } from "@/lib/budget/calc";

export default function AlertBanner({ summary }: { summary: BudgetSummary }) {
  const messages: string[] = [];

  if (summary.overCategories.length > 0) {
    messages.push(
      `Over budget in ${summary.overCategories.join(", ")}. Spending in ${
        summary.overCategories.length > 1
          ? "these categories has"
          : "this category has"
      } exceeded its allocation.`
    );
  }

  if (summary.projectedOverBudget) {
    messages.push(
      `At your current daily burn rate of ${formatGbp(
        summary.dailyBurn
      )}, projected total spend is ${formatGbp(
        summary.projectedSpend
      )} — ${formatGbp(
        summary.projectedSpend - summary.totalBudget
      )} over your ${formatGbp(summary.totalBudget)} budget.`
    );
  }

  if (messages.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <p className="font-semibold text-red-800">Heads up — budget at risk</p>
        <ul className="mt-1 space-y-1 text-sm text-red-700">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
