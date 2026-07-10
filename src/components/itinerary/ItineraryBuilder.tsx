"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDestination } from "@/data/destinations";
import type { TimeOfDay } from "@/types/trip";
import {
  FREE_MAX_DAYS,
  TIMES_OF_DAY,
  formatDayDate,
  addDaysIso,
  tripTotalCost,
  type BuilderActivity,
  type BuilderDay,
  type BuilderTrip,
} from "@/lib/itinerary/types";
import { saveLocalTrip } from "@/lib/itinerary/local";
import {
  addActivityToDay,
  addDayToTrip,
  deleteActivityFromDay,
  deleteDayFromTrip,
  renameTrip,
  reorderDayActivities,
  updateActivityInDay,
} from "@/lib/itinerary/actions";
import UpgradeCard from "@/components/itinerary/UpgradeCard";
import { cn } from "@/lib/utils";

// ─── constants ───────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<TimeOfDay, { label: string; icon: string }> = {
  morning: { label: "Morning", icon: "🌅" },
  afternoon: { label: "Afternoon", icon: "☀️" },
  evening: { label: "Evening", icon: "🌙" },
};

const GENERIC_SUGGESTIONS = [
  "Walking tour of the old town",
  "Visit the main museum or gallery",
  "Explore a local market",
  "Sunset viewpoint",
  "Try a traditional restaurant",
];

const PRO_MAX_DAYS = 60;

function tempId(): string {
  return `tmp-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;
}

function isTempId(id: string): boolean {
  return id.startsWith("tmp-");
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

// ─── activity form ───────────────────────────────────────────────────────────

interface ActivityFormValues {
  title: string;
  notes: string;
  cost: string;
}

function ActivityForm({
  initial,
  onSave,
  onCancel,
  saveLabel,
}: {
  initial?: ActivityFormValues;
  onSave: (values: ActivityFormValues) => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [values, setValues] = useState<ActivityFormValues>(
    initial ?? { title: "", notes: "", cost: "" }
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) return;
    onSave(values);
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="rounded-xl border border-primary-300 bg-white p-3 shadow-sm ring-2 ring-primary-100"
    >
      <input
        autoFocus
        type="text"
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        placeholder="What are you doing? *"
        aria-label="Activity title"
        required
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          placeholder="Notes (optional)"
          aria-label="Notes"
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.cost}
          onChange={(e) => setValues((v) => ({ ...v, cost: e.target.value }))}
          placeholder="Cost ($)"
          aria-label="Estimated cost"
          className="w-24 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Cancel
        </button>
        <span className="ml-auto hidden text-[11px] text-neutral-400 sm:block">
          Enter to save · Esc to cancel
        </span>
      </div>
    </form>
  );
}

// ─── main builder ────────────────────────────────────────────────────────────

export interface ItineraryBuilderProps {
  initialTrip: BuilderTrip;
  mode: "local" | "remote";
  isPro?: boolean;
  /** Local mode only: suppress the sign-up banner when already authed. */
  isAuthed?: boolean;
  /** Shown when a just-signed-up user's import failed on the trip cap. */
  importBlocked?: boolean;
}

export default function ItineraryBuilder({
  initialTrip,
  mode,
  isPro = false,
  isAuthed = false,
  importBlocked = false,
}: ItineraryBuilderProps) {
  const router = useRouter();
  const isLocal = mode === "local";
  const maxDays = isPro ? PRO_MAX_DAYS : FREE_MAX_DAYS;

  const [trip, setTrip] = useState<BuilderTrip>(initialTrip);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(
    initialTrip.days[0]?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [dayLimitHit, setDayLimitHit] = useState(false);

  // Editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(trip.title);
  const [addingIn, setAddingIn] = useState<TimeOfDay | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(
    null
  );

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    time: TimeOfDay;
    index: number;
  } | null>(null);

  const selectedDay =
    trip.days.find((d) => d.id === selectedDayId) ?? trip.days[0] ?? null;
  const selectedIndex = selectedDay
    ? trip.days.findIndex((d) => d.id === selectedDay.id)
    : 0;

  const totalCost = tripTotalCost(trip);

  // Seed suggestions: city slugs from search are "country/city", so also try
  // the bare city segment against the curated destination list.
  const seed = useMemo(() => {
    const slug = trip.destinationSlug;
    return (
      getDestination(slug) ?? getDestination(slug.split("/").pop() ?? slug)
    );
  }, [trip.destinationSlug]);

  /** Apply a state change, persisting to localStorage in local mode. */
  function apply(next: BuilderTrip) {
    setTrip(next);
    if (isLocal) saveLocalTrip(next);
  }

  function fail(message: string) {
    setError(message);
    if (!isLocal) router.refresh();
  }

  function patchDay(
    base: BuilderTrip,
    dayId: string,
    patch: (d: BuilderDay) => BuilderDay
  ): BuilderTrip {
    return {
      ...base,
      days: base.days.map((d) => (d.id === dayId ? patch(d) : d)),
    };
  }

  // ── trip title ──────────────────────────────────────────────────────────

  function saveTitle() {
    const title = titleDraft.trim() || trip.title;
    setEditingTitle(false);
    setTitleDraft(title);
    if (title === trip.title) return;
    apply({ ...trip, title });
    if (!isLocal) {
      void renameTrip(trip.id, title).then((r) => {
        if (r.error) fail("Couldn't rename the trip.");
      });
    }
  }

  // ── days ────────────────────────────────────────────────────────────────

  function handleAddDay() {
    if (trip.days.length >= maxDays) {
      setDayLimitHit(true);
      return;
    }
    const last = trip.days[trip.days.length - 1];
    const newDay: BuilderDay = {
      id: tempId(),
      dayNumber: (last?.dayNumber ?? 0) + 1,
      date: last?.date ? addDaysIso(last.date, 1) : null,
      activities: [],
    };
    apply({ ...trip, days: [...trip.days, newDay] });
    setSelectedDayId(newDay.id);

    if (!isLocal) {
      void addDayToTrip(trip.id).then((r) => {
        if (r.error === "day_limit") {
          setDayLimitHit(true);
          setTrip((prev) => ({
            ...prev,
            days: prev.days.filter((d) => d.id !== newDay.id),
          }));
        } else if (r.error) {
          fail("Couldn't add the day.");
        } else if (r.dayId) {
          setTrip((prev) => ({
            ...prev,
            days: prev.days.map((d) =>
              d.id === newDay.id
                ? { ...d, id: r.dayId!, date: r.date ?? d.date }
                : d
            ),
          }));
          setSelectedDayId((cur) => (cur === newDay.id ? r.dayId! : cur));
        }
      });
    }
  }

  function handleDeleteDay(dayId: string) {
    if (trip.days.length <= 1) return;
    const remaining = trip.days
      .filter((d) => d.id !== dayId)
      .map((d, i) => ({ ...d, dayNumber: i + 1 }));
    apply({ ...trip, days: remaining });
    if (selectedDayId === dayId) setSelectedDayId(remaining[0]?.id ?? null);

    if (!isLocal && !isTempId(dayId)) {
      void deleteDayFromTrip(trip.id, dayId).then((r) => {
        if (r.error) fail("Couldn't delete the day.");
      });
    }
  }

  // ── activities ──────────────────────────────────────────────────────────

  function parseCost(raw: string): number | null {
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }

  function handleAddActivity(timeOfDay: TimeOfDay, values: ActivityFormValues) {
    if (!selectedDay) return;
    const sectionMax = selectedDay.activities
      .filter((a) => a.timeOfDay === timeOfDay)
      .reduce((m, a) => Math.max(m, a.sortOrder), -1);

    const activity: BuilderActivity = {
      id: tempId(),
      timeOfDay,
      title: values.title.trim(),
      notes: values.notes.trim() || null,
      cost: parseCost(values.cost),
      sortOrder: sectionMax + 1,
    };

    const dayId = selectedDay.id;
    apply(
      patchDay(trip, dayId, (d) => ({
        ...d,
        activities: [...d.activities, activity],
      }))
    );
    setAddingIn(null);

    if (!isLocal && !isTempId(dayId)) {
      void addActivityToDay(trip.id, dayId, {
        timeOfDay,
        title: activity.title,
        notes: activity.notes,
        cost: activity.cost,
        sortOrder: activity.sortOrder,
      }).then((r) => {
        if (r.error) {
          fail("Couldn't add the activity.");
          setTrip((prev) =>
            patchDay(prev, dayId, (d) => ({
              ...d,
              activities: d.activities.filter((a) => a.id !== activity.id),
            }))
          );
        } else if (r.activityId) {
          setTrip((prev) =>
            patchDay(prev, dayId, (d) => ({
              ...d,
              activities: d.activities.map((a) =>
                a.id === activity.id ? { ...a, id: r.activityId! } : a
              ),
            }))
          );
        }
      });
    }
  }

  function handleUpdateActivity(
    activityId: string,
    values: ActivityFormValues
  ) {
    if (!selectedDay) return;
    const dayId = selectedDay.id;
    const patch = {
      title: values.title.trim(),
      notes: values.notes.trim() || null,
      cost: parseCost(values.cost),
    };
    apply(
      patchDay(trip, dayId, (d) => ({
        ...d,
        activities: d.activities.map((a) =>
          a.id === activityId ? { ...a, ...patch } : a
        ),
      }))
    );
    setEditingActivityId(null);

    if (!isLocal && !isTempId(activityId)) {
      void updateActivityInDay(trip.id, activityId, patch).then((r) => {
        if (r.error) fail("Couldn't save your changes.");
      });
    }
  }

  function handleDeleteActivity(activityId: string) {
    if (!selectedDay) return;
    const dayId = selectedDay.id;
    apply(
      patchDay(trip, dayId, (d) => ({
        ...d,
        activities: d.activities.filter((a) => a.id !== activityId),
      }))
    );
    if (!isLocal && !isTempId(activityId)) {
      void deleteActivityFromDay(trip.id, activityId).then((r) => {
        if (r.error) fail("Couldn't delete the activity.");
      });
    }
  }

  // ── drag to reorder ─────────────────────────────────────────────────────

  function moveActivity(
    activityId: string,
    toTime: TimeOfDay,
    toIndex: number
  ) {
    if (!selectedDay) return;
    const dayId = selectedDay.id;
    const day = trip.days.find((d) => d.id === dayId);
    const moving = day?.activities.find((a) => a.id === activityId);
    if (!day || !moving) return;

    // Rebuild per-section ordered lists without the moved card, insert it at
    // the drop position, then re-number sort_order sequentially per section.
    const bySection: Record<TimeOfDay, BuilderActivity[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const a of [...day.activities].sort(
      (x, y) => x.sortOrder - y.sortOrder
    )) {
      if (a.id !== activityId) bySection[a.timeOfDay].push(a);
    }
    const insertAt = Math.max(0, Math.min(toIndex, bySection[toTime].length));
    bySection[toTime].splice(insertAt, 0, { ...moving, timeOfDay: toTime });

    const nextActivities: BuilderActivity[] = [];
    const updates: { id: string; sortOrder: number; timeOfDay: TimeOfDay }[] =
      [];
    for (const t of TIMES_OF_DAY) {
      bySection[t].forEach((a, i) => {
        nextActivities.push({ ...a, timeOfDay: t, sortOrder: i });
        updates.push({ id: a.id, sortOrder: i, timeOfDay: t });
      });
    }

    apply(patchDay(trip, dayId, (d) => ({ ...d, activities: nextActivities })));

    if (!isLocal) {
      const persisted = updates.filter((u) => !isTempId(u.id));
      if (persisted.length > 0) {
        void reorderDayActivities(trip.id, persisted).then((r) => {
          if (r.error) fail("Couldn't save the new order.");
        });
      }
    }
  }

  function handleDrop() {
    if (dragId && dropTarget) {
      moveActivity(dragId, dropTarget.time, dropTarget.index);
    }
    setDragId(null);
    setDropTarget(null);
  }

  // ── suggestions ─────────────────────────────────────────────────────────

  function suggestionFor(dayIndex: number): string {
    const fromSeed = seed?.sampleItinerary[dayIndex % 3]?.morning;
    return (
      fromSeed ?? GENERIC_SUGGESTIONS[dayIndex % GENERIC_SUGGESTIONS.length]
    );
  }

  // ── render ──────────────────────────────────────────────────────────────

  const dateRange =
    trip.startDate && trip.endDate
      ? `${formatDayDate(trip.startDate)} – ${formatDayDate(trip.endDate)}`
      : "Dates TBC";

  return (
    <div>
      {/* Anonymous save banner */}
      {isLocal && !isAuthed && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <p className="text-sm text-primary-900">
            <span className="font-semibold">
              This trip is saved in your browser.
            </span>{" "}
            Sign up free to keep it across devices.
          </p>
          <Link
            href={`/signup?returnTo=/itinerary/${trip.id}`}
            className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          >
            Sign up free
          </Link>
        </div>
      )}

      {importBlocked && (
        <UpgradeCard variant="trips" className="mb-6 max-w-xl" />
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="ml-3 font-bold hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        {/* ══ Left rail ══ */}
        <aside className="space-y-5">
          {/* Trip title */}
          <div>
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(trip.title);
                    setEditingTitle(false);
                  }
                }}
                aria-label="Trip title"
                className="w-full rounded-lg border border-primary-300 px-2 py-1 text-xl font-bold tracking-tight text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            ) : (
              <button
                onClick={() => {
                  setTitleDraft(trip.title);
                  setEditingTitle(true);
                }}
                title="Rename trip"
                className="group flex w-full items-center gap-2 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                  {trip.title}
                </h1>
                <span
                  aria-hidden="true"
                  className="text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ✎
                </span>
              </button>
            )}
            <p className="mt-1 text-sm text-neutral-500">
              {trip.destinationName}
              {trip.country && trip.country !== trip.destinationName
                ? `, ${trip.country}`
                : ""}{" "}
              · {dateRange} · {trip.travellerCount} traveller
              {trip.travellerCount === 1 ? "" : "s"}
            </p>
          </div>

          {/* Running cost total */}
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Estimated trip cost
            </p>
            <p className="mt-0.5 text-2xl font-bold text-neutral-900">
              {formatMoney(totalCost)}
            </p>
          </div>

          {/* Day tabs */}
          <nav aria-label="Trip days">
            <ul className="space-y-1.5">
              {trip.days.map((day, i) => {
                const isSelected = selectedDay?.id === day.id;
                const dateLabel = formatDayDate(day.date);
                return (
                  <li key={day.id} className="group relative">
                    <button
                      onClick={() => setSelectedDayId(day.id)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        isSelected
                          ? "border-primary-300 bg-primary-50 font-semibold text-primary-900"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                      )}
                    >
                      Day {i + 1}
                      {dateLabel && (
                        <span
                          className={cn(
                            "font-normal",
                            isSelected ? "text-primary-700" : "text-neutral-400"
                          )}
                        >
                          {" "}
                          · {dateLabel}
                        </span>
                      )}
                      <span className="float-right font-normal text-neutral-400">
                        {day.activities.length || ""}
                      </span>
                    </button>
                    {trip.days.length > 1 && (
                      <button
                        onClick={() => handleDeleteDay(day.id)}
                        aria-label={`Delete day ${i + 1}`}
                        className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs text-neutral-400 shadow-sm transition-colors hover:border-red-200 hover:text-red-600 group-hover:flex"
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Add day / limit */}
            {trip.days.length < maxDays ? (
              <button
                onClick={handleAddDay}
                className="mt-3 w-full rounded-xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:border-primary-400 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                + Add day
              </button>
            ) : (
              !isPro && <UpgradeCard variant="days" className="mt-3" />
            )}
            {dayLimitHit && trip.days.length < maxDays && (
              <UpgradeCard variant="days" className="mt-3" />
            )}
          </nav>
        </aside>

        {/* ══ Main panel ══ */}
        <section aria-label="Day planner" className="min-w-0">
          {selectedDay ? (
            <>
              <h2 className="text-lg font-bold tracking-tight text-neutral-900">
                Day {selectedIndex + 1}
                {formatDayDate(selectedDay.date) && (
                  <span className="font-normal text-neutral-500">
                    {" "}
                    · {formatDayDate(selectedDay.date)}
                  </span>
                )}
              </h2>

              {/* Empty-day hint with one-click suggestion */}
              {selectedDay.activities.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-4">
                  <p className="text-sm text-neutral-600">
                    Nothing planned yet — add your first activity.
                  </p>
                  <button
                    onClick={() =>
                      handleAddActivity("morning", {
                        title: suggestionFor(selectedIndex),
                        notes: "",
                        cost: "",
                      })
                    }
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3.5 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <span aria-hidden="true">✨</span>
                    {suggestionFor(selectedIndex)}
                  </button>
                </div>
              )}

              {/* Morning / Afternoon / Evening */}
              <div className="mt-6 space-y-8">
                {TIMES_OF_DAY.map((time) => {
                  const items = selectedDay.activities
                    .filter((a) => a.timeOfDay === time)
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                  const { label, icon } = SECTION_LABELS[time];

                  return (
                    <div
                      key={time}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!dropTarget || dropTarget.time !== time) {
                          setDropTarget({ time, index: items.length });
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop();
                      }}
                      className={cn(
                        "rounded-2xl border p-4 transition-colors",
                        dragId && dropTarget?.time === time
                          ? "border-primary-300 bg-primary-50/40"
                          : "border-neutral-200 bg-white"
                      )}
                    >
                      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                        <span aria-hidden="true">{icon}</span>
                        {label}
                      </h3>

                      <ul className="mt-3 space-y-2">
                        {items.map((activity, index) =>
                          editingActivityId === activity.id ? (
                            <li key={activity.id}>
                              <ActivityForm
                                initial={{
                                  title: activity.title,
                                  notes: activity.notes ?? "",
                                  cost:
                                    activity.cost != null
                                      ? String(activity.cost)
                                      : "",
                                }}
                                saveLabel="Save"
                                onSave={(v) =>
                                  handleUpdateActivity(activity.id, v)
                                }
                                onCancel={() => setEditingActivityId(null)}
                              />
                            </li>
                          ) : (
                            <li
                              key={activity.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setDragId(activity.id);
                              }}
                              onDragEnd={() => {
                                setDragId(null);
                                setDropTarget(null);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDropTarget({ time, index });
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDrop();
                              }}
                              className={cn(
                                "group flex cursor-grab items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-all active:cursor-grabbing",
                                dragId === activity.id && "opacity-40",
                                dragId &&
                                  dropTarget?.time === time &&
                                  dropTarget.index === index &&
                                  "ring-2 ring-primary-400"
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className="mt-0.5 select-none text-neutral-300"
                              >
                                ⠿
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-neutral-900">
                                  {activity.title}
                                </p>
                                {activity.notes && (
                                  <p className="mt-0.5 text-sm text-neutral-500">
                                    {activity.notes}
                                  </p>
                                )}
                              </div>
                              {activity.cost != null && (
                                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                                  {formatMoney(activity.cost)}
                                </span>
                              )}
                              <span className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                <button
                                  onClick={() =>
                                    setEditingActivityId(activity.id)
                                  }
                                  aria-label={`Edit ${activity.title}`}
                                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteActivity(activity.id)
                                  }
                                  aria-label={`Delete ${activity.title}`}
                                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                >
                                  🗑
                                </button>
                              </span>
                            </li>
                          )
                        )}
                      </ul>

                      {/* Add activity */}
                      {addingIn === time ? (
                        <div className="mt-3">
                          <ActivityForm
                            saveLabel="Add activity"
                            onSave={(v) => handleAddActivity(time, v)}
                            onCancel={() => setAddingIn(null)}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingIn(time);
                            setEditingActivityId(null);
                          }}
                          className="mt-3 text-sm font-medium text-primary-700 transition-colors hover:text-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          + Add activity
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <p className="text-neutral-600">
                No days yet — add your first day to start planning.
              </p>
              <button
                onClick={handleAddDay}
                className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                + Add day
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
