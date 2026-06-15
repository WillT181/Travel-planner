"use client";

import { useState } from "react";
import type { BudgetSummary } from "@/lib/budget/calc";
import { formatGbp } from "@/lib/budget/calc";

function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.min(percent, 1);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const pct = Math.round(percent * 100);

  const color =
    percent > 1 ? "#dc2626" : percent >= 0.8 ? "#f59e0b" : "#0d9488";

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-neutral-900">{pct}%</span>
        <span className="text-xs text-neutral-500">used</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "negative";
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-lg font-bold ${
          tone === "negative" ? "text-red-600" : "text-neutral-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function BudgetOverview({
  summary,
  onSaveTotal,
  isPending,
}: {
  summary: BudgetSummary;
  onSaveTotal: (total: number) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(summary.totalBudget.toString());

  function save() {
    const n = parseFloat(value);
    if (!Number.isNaN(n) && n >= 0) onSaveTotal(n);
    setEditing(false);
  }

  return (
    <section
      className="rounded-2xl border border-neutral-200 bg-white p-6"
      aria-label="Budget overview"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ProgressRing percent={summary.percentUsed} />

        <div className="flex-1">
          <div className="mb-4 flex items-center gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Total budget
              </p>
              {editing ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    className="w-32 rounded-lg border border-neutral-300 px-2 py-1 text-lg font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={save}
                    disabled={isPending}
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-2xl font-bold text-neutral-900">
                    {formatGbp(summary.totalBudget)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setValue(summary.totalBudget.toString());
                      setEditing(true);
                    }}
                    aria-label="Edit total budget"
                    className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
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
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Spent" value={formatGbp(summary.totalSpent)} />
            <Stat
              label="Remaining"
              value={formatGbp(summary.remaining)}
              tone={summary.remaining < 0 ? "negative" : "default"}
            />
            <Stat label="Daily burn" value={formatGbp(summary.dailyBurn)} />
            <Stat label="Per person" value={formatGbp(summary.perPerson)} />
          </dl>

          {summary.daysRemaining > 0 && (
            <p className="mt-3 text-sm text-neutral-500">
              {summary.daysRemaining} day
              {summary.daysRemaining === 1 ? "" : "s"} remaining · projected
              total{" "}
              <span
                className={
                  summary.projectedOverBudget
                    ? "font-semibold text-red-600"
                    : "font-semibold text-neutral-700"
                }
              >
                {formatGbp(summary.projectedSpend)}
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
