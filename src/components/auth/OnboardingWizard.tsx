"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import {
  saveOnboarding,
  type TravelCompanions,
} from "@/app/onboarding/actions";

const COMPANION_OPTIONS: {
  value: TravelCompanions;
  label: string;
  hint: string;
}[] = [
  { value: "solo", label: "Solo", hint: "Just me" },
  { value: "couple", label: "Couple", hint: "Two of us" },
  { value: "family", label: "Family", hint: "With kids" },
  { value: "group", label: "Group", hint: "Friends or more" },
];

const BUDGET_MIN = 0;
const BUDGET_MAX = 10000;
const BUDGET_STEP = 100;

const TOTAL_STEPS = 3;

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [companions, setCompanions] = useState<TravelCompanions | null>(null);
  const [budget, setBudget] = useState(2000);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAdvance =
    step === 1
      ? destination.trim().length > 0
      : step === 2
        ? companions !== null
        : true;

  const handleNext = () => {
    setError(null);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    if (!companions) {
      setError("Please choose who you're travelling with.");
      setStep(2);
      return;
    }
    startTransition(async () => {
      const result = await saveOnboarding({
        destination: destination.trim(),
        startDate,
        endDate,
        companions,
        budget,
      });
      // On success the action redirects; only errors return here.
      if (result?.error) setError(result.error);
    });
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-500">
            Step {step} of {TOTAL_STEPS}
          </span>
          <span className="font-medium text-primary-700">
            {Math.round((step / TOTAL_STEPS) * 100)}%
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <div
            className="h-full rounded-full bg-primary-600 transition-[width] duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
              What&apos;s your first trip?
            </h2>
            <p className="mt-1 text-neutral-600">
              Tell us where you&apos;re dreaming of going.
            </p>
          </div>

          <div>
            <label
              htmlFor="destination"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Destination
            </label>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Lisbon, Portugal"
              autoFocus
              className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="start-date"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Roughly from
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="end-date"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Roughly to
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
              Who are you travelling with?
            </h2>
            <p className="mt-1 text-neutral-600">
              We&apos;ll tailor suggestions to your group.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Who are you travelling with?"
            className="grid grid-cols-2 gap-3"
          >
            {COMPANION_OPTIONS.map((option) => {
              const selected = companions === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCompanions(option.value)}
                  className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                    selected
                      ? "border-primary-600 bg-primary-50"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <span className="font-semibold text-neutral-900">
                    {option.label}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
              Set a rough budget
            </h2>
            <p className="mt-1 text-neutral-600">
              Don&apos;t worry — you can fine-tune this later.
            </p>
          </div>

          <div className="text-center">
            <span className="text-4xl font-bold tracking-tight text-primary-700">
              {gbp.format(budget)}
              {budget >= BUDGET_MAX ? "+" : ""}
            </span>
          </div>

          <div>
            <input
              id="budget"
              type="range"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={BUDGET_STEP}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="Rough budget in pounds"
              aria-valuetext={gbp.format(budget)}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-primary-600"
            />
            <div className="mt-2 flex justify-between text-xs text-neutral-400">
              <span>{gbp.format(BUDGET_MIN)}</span>
              <span>{gbp.format(BUDGET_MAX)}+</span>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {/* Controls */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={step === 1 || isPending}
          className={step === 1 ? "invisible" : ""}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canAdvance || isPending}
          size="lg"
        >
          {isPending
            ? "Saving…"
            : step < TOTAL_STEPS
              ? "Continue"
              : "Finish & go to dashboard"}
        </Button>
      </div>
    </div>
  );
}
