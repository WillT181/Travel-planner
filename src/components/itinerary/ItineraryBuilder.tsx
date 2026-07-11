"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// ─── design tokens (Wanderly Builder design) ─────────────────────────────────

const SLOT_META: Record<
  TimeOfDay,
  { label: string; icon: string; accent: string }
> = {
  morning: { label: "Morning", icon: "🌅", accent: "#1E8A97" },
  afternoon: { label: "Afternoon", icon: "☀️", accent: "#ED9B40" },
  evening: { label: "Evening", icon: "🌙", accent: "#8A5A8F" },
};

const DONE_GREEN = "#3E8E5A";

const GENERIC_SUGGESTIONS: { title: string; slot: TimeOfDay }[] = [
  { title: "Walking tour of the old town", slot: "morning" },
  { title: "Explore a local market", slot: "morning" },
  { title: "Visit the main museum or gallery", slot: "afternoon" },
  { title: "Coffee & people-watching", slot: "afternoon" },
  { title: "Sunset viewpoint", slot: "evening" },
  { title: "Try a traditional restaurant", slot: "evening" },
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

  const inputClass =
    "rounded-xl border border-[#E7DECB] bg-[#FAF6EF] px-3 py-2 text-sm text-[#22303A] placeholder:text-[#97A4AA] focus:border-[#1E8A97] focus:outline-none focus:ring-1 focus:ring-[#1E8A97]";

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="rounded-2xl border-[1.5px] border-[#1E8A97] bg-[#FDFBF7] p-3 shadow-[0_6px_20px_rgba(34,48,58,0.08)]"
    >
      <input
        autoFocus
        type="text"
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        placeholder="What are you doing? *"
        aria-label="Activity title"
        required
        className={cn(inputClass, "w-full")}
      />
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          placeholder="Notes (optional)"
          aria-label="Notes"
          className={cn(inputClass, "min-w-0 flex-1")}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.cost}
          onChange={(e) => setValues((v) => ({ ...v, cost: e.target.value }))}
          placeholder="Cost ($)"
          aria-label="Estimated cost"
          className={cn(inputClass, "w-24")}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-full bg-[#ED9B40] px-4 py-2 text-xs font-semibold text-[#3A2408] transition-colors hover:bg-[#DE8B2F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-2 text-xs font-medium text-[#5E6E76] transition-colors hover:bg-[#F1E9DA] hover:text-[#22303A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
        >
          Cancel
        </button>
        <span className="ml-auto hidden text-[11px] text-[#97A4AA] sm:block">
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
  const [bannerDismissed, setBannerDismissed] = useState(false);

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

  // Toast
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const selectedDay =
    trip.days.find((d) => d.id === selectedDayId) ?? trip.days[0] ?? null;
  const selectedIndex = selectedDay
    ? trip.days.findIndex((d) => d.id === selectedDay.id)
    : 0;

  const allActivities = trip.days.flatMap((d) => d.activities);
  const totalCost = tripTotalCost(trip);
  const doneCount = allActivities.filter((a) => a.done).length;

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

  // ── share ───────────────────────────────────────────────────────────────

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(
        isLocal
          ? "Link copied — note: this trip lives only on this device"
          : "Link copied — send it to your crew"
      );
    } catch {
      showToast("Couldn't copy the link.");
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

  function handleAddActivity(
    timeOfDay: TimeOfDay,
    values: ActivityFormValues,
    opts?: { toast?: boolean }
  ) {
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
      done: false,
    };

    const dayId = selectedDay.id;
    apply(
      patchDay(trip, dayId, (d) => ({
        ...d,
        activities: [...d.activities, activity],
      }))
    );
    setAddingIn(null);

    if (opts?.toast) {
      const newTotal = totalCost + (activity.cost ?? 0);
      showToast(
        `Added to Day ${selectedIndex + 1} — trip total ${formatMoney(newTotal)}`
      );
    }

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

  function handleToggleDone(activityId: string) {
    if (!selectedDay) return;
    const dayId = selectedDay.id;
    const current = selectedDay.activities.find((a) => a.id === activityId);
    if (!current) return;
    const nextDone = !current.done;

    apply(
      patchDay(trip, dayId, (d) => ({
        ...d,
        activities: d.activities.map((a) =>
          a.id === activityId ? { ...a, done: nextDone } : a
        ),
      }))
    );

    if (!isLocal && !isTempId(activityId)) {
      void updateActivityInDay(trip.id, activityId, { done: nextDone }).then(
        (r) => {
          if (r.error) fail("Couldn't save your changes.");
        }
      );
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

  // ── suggestions ("Ideas for Day X") ─────────────────────────────────────

  const suggestions = useMemo(() => {
    if (!selectedDay) return [];
    const taken = new Set(
      selectedDay.activities.map((a) => a.title.toLowerCase())
    );
    const pool: { title: string; slot: TimeOfDay }[] = [];

    const sample = seed?.sampleItinerary[selectedIndex % 3];
    if (sample) {
      pool.push(
        { title: sample.morning, slot: "morning" },
        { title: sample.afternoon, slot: "afternoon" },
        { title: sample.evening, slot: "evening" }
      );
    }
    pool.push(...GENERIC_SUGGESTIONS);

    const seen = new Set<string>();
    return pool
      .filter((s) => {
        const key = s.title.toLowerCase();
        if (taken.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [selectedDay, selectedIndex, seed]);

  // ── render ──────────────────────────────────────────────────────────────

  const dateRange =
    trip.startDate && trip.endDate
      ? `${formatDayDate(trip.startDate)} – ${formatDayDate(trip.endDate)}`
      : "Dates TBC";

  const dayTab = (day: BuilderDay, i: number, horizontal: boolean) => {
    const isSelected = selectedDay?.id === day.id;
    const dateLabel = formatDayDate(day.date);
    const stops = day.activities.length;
    return (
      <div
        key={day.id}
        className={cn("group relative", !horizontal && "w-full")}
      >
        <button
          onClick={() => setSelectedDayId(day.id)}
          aria-current={isSelected ? "true" : undefined}
          className={cn(
            "flex items-center justify-between gap-2 rounded-2xl border px-[18px] py-3.5 text-left text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]",
            horizontal ? "whitespace-nowrap rounded-full py-2.5" : "w-full",
            isSelected
              ? "border-[#17727F] bg-[#17727F] text-[#FDFBF7]"
              : "border-[#E7DECB] bg-[#FDFBF7] text-[#17727F] hover:bg-[#F1E9DA]/60"
          )}
        >
          <span>
            Day {i + 1}
            {dateLabel && !horizontal && (
              <span
                className={cn(
                  "font-normal",
                  isSelected ? "text-[#C9E7E9]" : "text-[#97A4AA]"
                )}
              >
                {" "}
                · {dateLabel}
              </span>
            )}
          </span>
          {!horizontal && (
            <span className="text-[12.5px] font-semibold opacity-75">
              {stops} {stops === 1 ? "stop" : "stops"}
            </span>
          )}
        </button>
        {trip.days.length > 1 && !horizontal && (
          <button
            onClick={() => handleDeleteDay(day.id)}
            aria-label={`Delete day ${i + 1}`}
            className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-[#E7DECB] bg-[#FDFBF7] text-xs text-[#97A4AA] shadow-sm transition-colors hover:border-[#C6543F]/40 hover:text-[#C6543F] group-hover:flex"
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="font-instrument text-[#22303A]">
      {/* ══ Top bar ══ */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DECB]/70 pb-4">
        <div className="min-w-0">
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
              className="w-full rounded-lg border border-[#1E8A97] bg-[#FDFBF7] px-2 py-1 font-display text-lg font-bold tracking-tight text-[#22303A] focus:outline-none focus:ring-2 focus:ring-[#1E8A97]"
            />
          ) : (
            <button
              onClick={() => {
                setTitleDraft(trip.title);
                setEditingTitle(true);
              }}
              title="Rename trip"
              className="group flex items-center gap-2 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
            >
              <h1 className="truncate font-display text-lg font-bold tracking-tight">
                {trip.title}
              </h1>
              <span
                aria-hidden="true"
                className="text-[#D9CDB4] opacity-0 transition-opacity group-hover:opacity-100"
              >
                ✎
              </span>
            </button>
          )}
          <p className="text-[12.5px] text-[#5E6E76]">
            {trip.days.length} day{trip.days.length === 1 ? "" : "s"} ·{" "}
            {trip.travellerCount} traveller
            {trip.travellerCount === 1 ? "" : "s"} · {dateRange}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <span className="whitespace-nowrap rounded-full bg-[#DFF1F2] px-4 py-2.5 text-[13.5px] font-bold text-[#145C6B]">
            Trip total · {formatMoney(totalCost)}
          </span>
          <button
            onClick={handleShare}
            className="hidden rounded-full border-[1.5px] border-[#B8CDD1] bg-[#FDFBF7] px-[18px] py-2.5 text-sm font-semibold text-[#17727F] transition-colors hover:border-[#17727F] hover:bg-[#DFF1F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97] sm:block"
          >
            Share
          </button>
        </div>
      </header>

      {/* ══ Save banner (anonymous) ══ */}
      {isLocal && !isAuthed && !bannerDismissed && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#F0D9B5] bg-[#FBEEDC] px-4 py-2.5">
          <span className="text-[13.5px] text-[#6B4E1F]">
            <strong>Sign up free to keep this trip</strong> — it lives only on
            this device for now.
          </span>
          <Link
            href={`/signup?returnTo=/itinerary/${trip.id}`}
            className="rounded-full bg-[#ED9B40] px-4 py-2 text-[13px] font-semibold text-[#3A2408] transition-colors hover:bg-[#DE8B2F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
          >
            Sign up free
          </Link>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="text-[#B06D14] hover:text-[#6B4E1F]"
          >
            ×
          </button>
        </div>
      )}

      {importBlocked && (
        <div className="mt-4">
          <UpgradeCard variant="trips" className="max-w-xl" />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between rounded-2xl border border-[#C6543F]/30 bg-[#F6E3DE] px-4 py-3 text-sm text-[#8A3B2B]"
        >
          {error}
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="ml-3 font-bold hover:text-[#C6543F]"
          >
            ×
          </button>
        </div>
      )}

      {/* ══ Mobile day strip ══ */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {trip.days.map((day, i) => dayTab(day, i, true))}
        {trip.days.length < maxDays && (
          <button
            onClick={handleAddDay}
            className="flex-none whitespace-nowrap rounded-full border border-dashed border-[#D9CDB4] px-4 py-2.5 text-sm font-medium text-[#5E6E76] hover:border-[#1E8A97] hover:text-[#17727F]"
          >
            + Day
          </button>
        )}
      </div>

      {/* ══ Body ══ */}
      <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:mt-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden flex-col gap-5 lg:sticky lg:top-24 lg:flex">
          <div className="flex flex-col gap-1.5">
            {trip.days.map((day, i) => dayTab(day, i, false))}
            {trip.days.length < maxDays ? (
              <button
                onClick={handleAddDay}
                className="rounded-2xl border border-dashed border-[#D9CDB4] px-[18px] py-3 text-sm font-medium text-[#5E6E76] transition-colors hover:border-[#1E8A97] hover:text-[#17727F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
              >
                + Add day
              </button>
            ) : (
              !isPro && <UpgradeCard variant="days" className="mt-1" />
            )}
            {dayLimitHit && trip.days.length < maxDays && (
              <UpgradeCard variant="days" className="mt-1" />
            )}
          </div>

          {/* Trip summary */}
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-[#E7DECB] bg-[#FDFBF7] px-5 py-[18px]">
            <span className="text-xs font-bold uppercase tracking-[0.07em] text-[#5E6E76]">
              Trip summary
            </span>
            <div className="flex justify-between text-sm">
              <span className="text-[#5E6E76]">Activities</span>
              <strong>{allActivities.length}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#5E6E76]">Done</span>
              <strong>{doneCount}</strong>
            </div>
            <div className="flex justify-between border-t border-[#F1E9DA] pt-2.5 text-sm">
              <span className="text-[#5E6E76]">Est. cost</span>
              <strong className="text-[#145C6B]">
                {formatMoney(totalCost)}
              </strong>
            </div>
          </div>

          {!isPro && (
            <p className="px-1 text-[12.5px] leading-normal text-[#97A4AA]">
              Free plan · {trip.days.length} of {FREE_MAX_DAYS} days used
            </p>
          )}
        </aside>

        {/* ── Timeline ── */}
        <main aria-label="Day timeline" className="flex min-w-0 flex-col gap-6">
          {selectedDay ? (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-[-0.02em]">
                  Day {selectedIndex + 1} —{" "}
                  {selectedDay.activities.length === 0
                    ? "a blank canvas"
                    : `${selectedDay.activities.length} stop${
                        selectedDay.activities.length === 1 ? "" : "s"
                      }`}
                </h2>
                {formatDayDate(selectedDay.date) && (
                  <span className="text-sm text-[#5E6E76]">
                    {formatDayDate(selectedDay.date)}
                  </span>
                )}
              </div>

              {/* Empty state */}
              {selectedDay.activities.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-[22px] border-2 border-dashed border-[#D9CDB4] bg-[#FDFBF7]/60 px-6 py-11 text-center">
                  <span aria-hidden="true" className="text-[32px]">
                    🧭
                  </span>
                  <span className="font-display text-[19px] font-bold">
                    Nothing planned yet
                  </span>
                  <span className="max-w-[320px] text-[14.5px] text-[#5E6E76]">
                    Add your first activity below — mornings are a good place to
                    start.
                  </span>
                </div>
              )}

              {/* Slot sections */}
              {TIMES_OF_DAY.map((time) => {
                const meta = SLOT_META[time];
                const items = selectedDay.activities
                  .filter((a) => a.timeOfDay === time)
                  .sort((a, b) => a.sortOrder - b.sortOrder);

                return (
                  <section
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
                      "flex flex-col gap-2.5 rounded-2xl p-1 transition-colors",
                      dragId && dropTarget?.time === time && "bg-[#DFF1F2]/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="text-[15px]">
                        {meta.icon}
                      </span>
                      <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5E6E76]">
                        {meta.label}
                      </span>
                      <span className="h-px flex-1 bg-[#E7DECB]" />
                    </div>

                    {items.map((activity, index) =>
                      editingActivityId === activity.id ? (
                        <ActivityForm
                          key={activity.id}
                          initial={{
                            title: activity.title,
                            notes: activity.notes ?? "",
                            cost:
                              activity.cost != null
                                ? String(activity.cost)
                                : "",
                          }}
                          saveLabel="Save"
                          onSave={(v) => handleUpdateActivity(activity.id, v)}
                          onCancel={() => setEditingActivityId(null)}
                        />
                      ) : (
                        <div
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
                          style={{
                            borderLeft: `4px solid ${
                              activity.done ? DONE_GREEN : meta.accent
                            }`,
                          }}
                          className={cn(
                            "group flex cursor-grab items-center gap-3 rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] px-4 py-3.5 shadow-[0_1px_3px_rgba(34,48,58,0.06)] transition-all active:cursor-grabbing",
                            activity.done && "opacity-70",
                            dragId === activity.id && "opacity-40",
                            dragId &&
                              dropTarget?.time === time &&
                              dropTarget.index === index &&
                              "ring-2 ring-[#1E8A97]"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            title="Drag to reorder"
                            className="flex-none select-none px-0.5 py-1.5 tracking-[2px] text-[#B8CDD1]"
                          >
                            ⋮⋮
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span
                              className={cn(
                                "text-[15.5px] font-semibold",
                                activity.done &&
                                  "line-through decoration-[#3E8E5A]"
                              )}
                            >
                              {activity.title}
                            </span>
                            <span className="text-[13px] text-[#5E6E76]">
                              {meta.label}
                              {activity.notes ? ` · ${activity.notes}` : ""}
                              {activity.cost != null
                                ? ` · ${formatMoney(activity.cost)}`
                                : ""}
                            </span>
                          </div>
                          <span className="flex flex-none items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              onClick={() => setEditingActivityId(activity.id)}
                              aria-label={`Edit ${activity.title}`}
                              className="grid h-[34px] w-[34px] place-items-center rounded-full text-[#B8CDD1] transition-colors hover:bg-[#F1E9DA] hover:text-[#5E6E76] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteActivity(activity.id)}
                              aria-label={`Remove ${activity.title}`}
                              className="grid h-[34px] w-[34px] place-items-center rounded-full text-[#B8CDD1] transition-colors hover:bg-[#F6E3DE] hover:text-[#C6543F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6543F]"
                            >
                              ✕
                            </button>
                          </span>
                          <button
                            onClick={() => handleToggleDone(activity.id)}
                            aria-label={
                              activity.done
                                ? `Mark ${activity.title} not done`
                                : `Mark ${activity.title} done`
                            }
                            aria-pressed={Boolean(activity.done)}
                            className={cn(
                              "grid h-11 w-11 flex-none place-items-center rounded-full border-[1.5px] text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E8E5A]",
                              activity.done
                                ? "border-[#3E8E5A] bg-[#3E8E5A] text-[#FDFBF7]"
                                : "border-[#B8CDD1] bg-transparent text-transparent hover:border-[#3E8E5A]"
                            )}
                          >
                            ✓
                          </button>
                        </div>
                      )
                    )}

                    {/* Add activity */}
                    {addingIn === time ? (
                      <ActivityForm
                        saveLabel="Add activity"
                        onSave={(v) => handleAddActivity(time, v)}
                        onCancel={() => setAddingIn(null)}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setAddingIn(time);
                          setEditingActivityId(null);
                        }}
                        className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-[#17727F] transition-colors hover:bg-[#DFF1F2] hover:text-[#145C6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
                      >
                        + Add activity
                      </button>
                    )}
                  </section>
                );
              })}

              {/* Ideas for the day */}
              {suggestions.length > 0 && (
                <section className="mt-2 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5E6E76]">
                      Ideas for Day {selectedIndex + 1}
                    </span>
                    <span className="h-px flex-1 bg-[#E7DECB]" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {suggestions.map((sug) => (
                      <button
                        key={sug.title}
                        onClick={() =>
                          handleAddActivity(
                            sug.slot,
                            { title: sug.title, notes: "", cost: "" },
                            { toast: true }
                          )
                        }
                        className="flex min-h-[60px] items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-[#D9CDB4] bg-[#FDFBF7]/70 px-4 py-3 text-left transition-colors hover:border-[#1E8A97] hover:bg-[#FDFBF7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
                      >
                        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[#DFF1F2] text-[17px] font-semibold text-[#145C6B]">
                          +
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[14.5px] font-semibold text-[#22303A]">
                            {sug.title}
                          </span>
                          <span className="text-[12.5px] text-[#5E6E76]">
                            {SLOT_META[sug.slot].label}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-[22px] border-2 border-dashed border-[#D9CDB4] bg-[#FDFBF7]/60 p-10 text-center">
              <p className="text-[#5E6E76]">
                No days yet — add your first day to start planning.
              </p>
              <button
                onClick={handleAddDay}
                className="rounded-full bg-[#ED9B40] px-5 py-2.5 text-sm font-semibold text-[#3A2408] transition-colors hover:bg-[#DE8B2F]"
              >
                + Add day
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ══ Toast ══ */}
      {toast && (
        <div className="fixed bottom-7 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-[14px] bg-[#22303A] px-5 py-3 text-[#FDFBF7] shadow-[0_10px_30px_rgba(34,48,58,0.3)] animate-[fadeIn_0.25s_ease]">
          <span aria-hidden="true" className="text-[#7FD8A4]">
            ✓
          </span>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}
