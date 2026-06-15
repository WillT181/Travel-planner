"use client";

import { useState } from "react";
import type { BudgetSummary, CategoryStatus } from "@/lib/budget/calc";
import { formatGbp } from "@/lib/budget/calc";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  type Category,
} from "@/lib/budget/constants";

const STATUS_BADGE: Record<
  CategoryStatus,
  { label: string; className: string }
> = {
  "on-track": {
    label: "On track",
    className: "bg-primary-50 text-primary-700",
  },
  watch: { label: "Watch out", className: "bg-accent-100 text-accent-700" },
  over: { label: "Over budget", className: "bg-red-100 text-red-700" },
};

export default function CategoryBreakdown({
  summary,
  totalBudget,
  onSave,
  isPending,
}: {
  summary: BudgetSummary;
  totalBudget: number;
  onSave: (budgets: Partial<Record<Category, number>>) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      summary.categories.map((c) => [
        c.category,
        c.allocation > 0 ? c.allocation.toString() : "",
      ])
    )
  );

  const draftTotal = CATEGORIES.reduce(
    (sum, cat) => sum + (parseFloat(draft[cat]) || 0),
    0
  );
  const mismatch = Math.abs(draftTotal - totalBudget) > 0.5;

  function save() {
    const budgets: Partial<Record<Category, number>> = {};
    for (const cat of CATEGORIES) {
      const n = parseFloat(draft[cat]);
      if (!Number.isNaN(n) && n > 0) budgets[cat] = n;
    }
    onSave(budgets);
    setEditing(false);
  }

  return (
    <section
      className="rounded-2xl border border-neutral-200 bg-white p-6"
      aria-label="Category breakdown"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          By category
        </h2>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Save allocations
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            Set allocations
          </button>
        )}
      </div>

      <div className="space-y-4">
        {summary.categories.map((c) => {
          const badge = STATUS_BADGE[c.status];
          const barPct = c.allocation > 0 ? Math.min(c.percent, 1) * 100 : 0;
          const color = CATEGORY_COLORS[c.category];
          return (
            <div key={c.category}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-neutral-800">
                    {c.category}
                  </span>
                  {(c.allocation > 0 || c.spent > 0) && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
                {editing ? (
                  <div className="flex items-center gap-1 text-sm text-neutral-500">
                    <span>£</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={draft[c.category] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [c.category]: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-neutral-600">
                    {formatGbp(c.spent)}
                    <span className="text-neutral-400">
                      {" "}
                      / {formatGbp(c.allocation)}
                    </span>
                  </span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: c.status === "over" ? "#dc2626" : color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div
          className={`mt-5 rounded-lg px-3 py-2 text-sm ${
            mismatch
              ? "bg-accent-50 text-accent-800"
              : "bg-primary-50 text-primary-700"
          }`}
        >
          Allocated {formatGbp(draftTotal)} of {formatGbp(totalBudget)} total
          {mismatch &&
            ` — ${
              draftTotal > totalBudget ? "over" : "under"
            } by ${formatGbp(Math.abs(draftTotal - totalBudget))}`}
        </div>
      )}
    </section>
  );
}
