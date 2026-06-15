"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTotalBudget,
  setCategoryBudgets,
  addExpense,
  deleteExpense,
  exportBudgetPdf,
  type ExpenseInput,
} from "@/lib/budget/actions";
import { computeBudgetSummary } from "@/lib/budget/calc";
import type { Category } from "@/lib/budget/constants";
import type { TripBudget, Expense } from "@/types/budget";
import AlertBanner from "@/components/budget/AlertBanner";
import BudgetOverview from "@/components/budget/BudgetOverview";
import CategoryBreakdown from "@/components/budget/CategoryBreakdown";
import ExpenseLog from "@/components/budget/ExpenseLog";
import AddExpensePanel from "@/components/budget/AddExpensePanel";

interface Props {
  tripId: string;
  destinationName: string;
  travellerCount: number;
  startDate: string | null;
  endDate: string | null;
  budget: TripBudget;
  expenses: Expense[];
  defaultCurrency?: string;
}

export default function BudgetDashboard({
  tripId,
  destinationName,
  travellerCount,
  startDate,
  endDate,
  budget,
  expenses,
  defaultCurrency = "GBP",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const summary = computeBudgetSummary({
    budget,
    expenses,
    travellerCount,
    startDate,
    endDate,
  });

  function refresh() {
    router.refresh();
  }

  function handleSaveTotalBudget(total: number) {
    startTransition(async () => {
      await setTotalBudget(tripId, total);
      refresh();
    });
  }

  function handleSaveCategoryBudgets(
    budgets: Partial<Record<Category, number>>
  ) {
    startTransition(async () => {
      await setCategoryBudgets(tripId, budgets);
      refresh();
    });
  }

  function handleAddExpense(input: ExpenseInput) {
    setPanelOpen(false);
    startTransition(async () => {
      await addExpense(tripId, input);
      refresh();
    });
  }

  function handleDeleteExpense(expenseId: string) {
    setDeletingIds((prev) => new Set(Array.from(prev).concat(expenseId)));
    startTransition(async () => {
      await deleteExpense(tripId, expenseId);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
      refresh();
    });
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const result = await exportBudgetPdf(tripId);
      if (result.base64 && result.filename) {
        const bytes = Uint8Array.from(atob(result.base64), (c) =>
          c.charCodeAt(0)
        );
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-700">
            {destinationName}
          </p>
          <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-neutral-900">
            Budget tracker
          </h1>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exporting || isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? "Generating…" : "Export PDF"}
        </button>
      </div>

      {/* Smart alert banner */}
      <AlertBanner summary={summary} />

      {/* Overview ring + key stats */}
      <div
        className={
          summary.overCategories.length > 0 || summary.projectedOverBudget
            ? "mt-4"
            : ""
        }
      >
        <BudgetOverview
          summary={summary}
          onSaveTotal={handleSaveTotalBudget}
          isPending={isPending}
        />
      </div>

      {/* Category bars */}
      <div className="mt-4">
        <CategoryBreakdown
          summary={summary}
          totalBudget={budget.total_budget}
          onSave={handleSaveCategoryBudgets}
          isPending={isPending}
        />
      </div>

      {/* Expense log */}
      <div className="mt-4 pb-12">
        <ExpenseLog
          expenses={expenses.sort((a, b) => b.date.localeCompare(a.date))}
          onAddClick={() => setPanelOpen(true)}
          onDelete={handleDeleteExpense}
          deletingIds={deletingIds}
        />
      </div>

      {/* Slide-over panel */}
      <AddExpensePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleAddExpense}
        isPending={isPending}
        defaultCurrency={defaultCurrency}
      />
    </>
  );
}
