"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/budget/constants";
import { CURRENCIES, convertToGbp, useFxRates } from "@/lib/budget/fx";
import { formatGbp } from "@/lib/budget/calc";
import type { ExpenseInput } from "@/lib/budget/actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddExpensePanel({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ExpenseInput) => void;
  isPending: boolean;
}) {
  const { rates, source } = useFxRates();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("GBP");
  const [category, setCategory] = useState<Category>("Food & drink");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());

  // Reset to defaults each time the panel opens.
  useEffect(() => {
    if (open) {
      setAmount("");
      setCurrency("GBP");
      setCategory("Food & drink");
      setDescription("");
      setDate(todayIso());
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const numericAmount = parseFloat(amount) || 0;
  const amountGbp = convertToGbp(numericAmount, currency, rates);
  const canSubmit = numericAmount > 0 && description.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      category,
      description: description.trim(),
      amountLocal: numericAmount,
      currencyLocal: currency,
      amountGbp,
      date,
    });
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Scrim */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-neutral-900/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add expense"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">
            Add expense
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 py-5"
        >
          <div className="space-y-4">
            {/* Amount + currency */}
            <div>
              <label
                htmlFor="exp-amount"
                className="block text-sm font-medium text-neutral-700"
              >
                Amount
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="exp-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  required
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <select
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {currency !== "GBP" && numericAmount > 0 && (
                <p className="mt-1.5 text-sm text-neutral-500">
                  ≈{" "}
                  <span className="font-semibold">{formatGbp(amountGbp)}</span>{" "}
                  <span className="text-xs text-neutral-400">
                    ({source === "live" ? "live" : "static"} rate)
                  </span>
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="exp-category"
                className="block text-sm font-medium text-neutral-700"
              >
                Category
              </label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="exp-desc"
                className="block text-sm font-medium text-neutral-700"
              >
                Description
              </label>
              <input
                id="exp-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Dinner at the harbour"
                required
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Date */}
            <div>
              <label
                htmlFor="exp-date"
                className="block text-sm font-medium text-neutral-700"
              >
                Date
              </label>
              <input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="mt-auto flex gap-3 pt-6">
            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              Add expense
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
