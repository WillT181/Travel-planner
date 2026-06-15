"use client";

import { formatGbp } from "@/lib/budget/calc";
import { CATEGORY_COLORS } from "@/lib/budget/constants";
import type { Expense } from "@/types/budget";

export default function ExpenseLog({
  expenses,
  onAddClick,
  onDelete,
  deletingIds,
}: {
  expenses: Expense[];
  onAddClick: () => void;
  onDelete: (id: string) => void;
  deletingIds: Set<string>;
}) {
  const visible = expenses.filter((e) => !deletingIds.has(e.id));

  return (
    <section
      className="rounded-2xl border border-neutral-200 bg-white p-6"
      aria-label="Expense log"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          Expenses
        </h2>
        <button
          type="button"
          onClick={onAddClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add expense
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-500">
          No expenses logged yet. Add your first one to start tracking.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {visible.map((e) => (
            <li key={e.id} className="group flex items-center gap-3 py-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[e.category] }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {e.description}
                </p>
                <p className="text-xs text-neutral-500">
                  {new Date(e.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {e.category}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-neutral-900">
                  {formatGbp(e.amount_gbp)}
                </p>
                {e.currency_local !== "GBP" && (
                  <p className="text-xs text-neutral-400">
                    {e.amount_local.toLocaleString()} {e.currency_local}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDelete(e.id)}
                aria-label={`Delete expense ${e.description}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:text-neutral-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
