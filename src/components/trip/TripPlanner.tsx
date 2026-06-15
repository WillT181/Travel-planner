"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Trip, TimeOfDay } from "@/types/trip";
import type { TripInvite, TripMember, TripRole } from "@/types/collaboration";
import {
  addDay,
  deleteDay,
  addActivity,
  deleteActivity,
  updateActivity,
} from "@/lib/trips/actions";
import { requestEditAccess } from "@/lib/trips/collaboration";
import { useTripRealtime } from "@/hooks/useTripRealtime";
import ActivityCard from "@/components/trip/ActivityCard";
import MemberAvatars from "@/components/trip/MemberAvatars";
import TripSettings from "@/components/trip/TripSettings";

const FREE_MAX_DAYS = 5;

const TIME_SLOTS: { key: TimeOfDay; label: string; icon: string }[] = [
  { key: "morning", label: "Morning", icon: "🌅" },
  { key: "afternoon", label: "Afternoon", icon: "☀️" },
  { key: "evening", label: "Evening", icon: "🌙" },
];

interface AddFormState {
  dayId: string;
  timeOfDay: TimeOfDay;
}

interface TripPlannerProps {
  trip: Trip;
  role: TripRole;
  canEdit: boolean;
  members: TripMember[];
  invites: TripInvite[];
  currentUserId: string;
  isOwnerPro: boolean;
}

export default function TripPlanner({
  trip,
  role,
  canEdit,
  members,
  invites,
  currentUserId,
  isOwnerPro,
}: TripPlannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(
    trip.trip_days[0]?.id ?? null
  );
  const [deletingActivityIds, setDeletingActivityIds] = useState<Set<string>>(
    new Set()
  );
  const [addForm, setAddForm] = useState<AddFormState | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [dayLimitHit, setDayLimitHit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editRequested, setEditRequested] = useState(
    members.find((m) => m.user_id === currentUserId)?.edit_requested ?? false
  );

  const selectedDay =
    trip.trip_days.find((d) => d.id === selectedDayId) ??
    trip.trip_days[0] ??
    null;
  const atDayLimit = trip.trip_days.length >= FREE_MAX_DAYS;

  function refresh() {
    router.refresh();
  }

  // Live collaboration: refresh when a co-traveller changes the plan.
  useTripRealtime(trip.id, refresh);

  function handleRequestEdit() {
    setEditRequested(true);
    startTransition(async () => {
      await requestEditAccess(trip.id);
      refresh();
    });
  }

  function handleAddDay() {
    startTransition(async () => {
      const result = await addDay(trip.id);
      if (result.error === "free_limit") {
        setDayLimitHit(true);
        return;
      }
      if (result.dayId) {
        setSelectedDayId(result.dayId);
      }
      refresh();
    });
  }

  function handleDeleteDay(dayId: string) {
    const remaining = trip.trip_days.filter((d) => d.id !== dayId);
    if (selectedDayId === dayId) {
      setSelectedDayId(remaining[0]?.id ?? null);
    }
    startTransition(async () => {
      await deleteDay(dayId, trip.id);
      refresh();
    });
  }

  function openAddForm(dayId: string, timeOfDay: TimeOfDay) {
    setAddForm({ dayId, timeOfDay });
    setAddTitle("");
    setAddNotes("");
  }

  function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm || !addTitle.trim()) return;
    const { dayId, timeOfDay } = addForm;
    const title = addTitle;
    const notes = addNotes;
    setAddForm(null);
    setAddTitle("");
    setAddNotes("");
    startTransition(async () => {
      await addActivity(dayId, trip.id, { timeOfDay, title, notes });
      refresh();
    });
  }

  function handleDeleteActivity(activityId: string) {
    setDeletingActivityIds(
      (prev) => new Set(Array.from(prev).concat(activityId))
    );
    startTransition(async () => {
      await deleteActivity(activityId, trip.id);
      setDeletingActivityIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
      refresh();
    });
  }

  function handleUpdateActivity(
    activityId: string,
    data: { title?: string; notes?: string; durationMins?: number }
  ) {
    startTransition(async () => {
      await updateActivity(activityId, trip.id, data);
      refresh();
    });
  }

  return (
    <div className="mt-6">
      {/* Trip header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {trip.country && (
            <p className="text-sm font-medium text-primary-700">
              {trip.country}
            </p>
          )}
          <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {trip.title ??
              `Trip to ${trip.destination_name ?? "your destination"}`}
          </h1>
          {(trip.start_date || trip.end_date) && (
            <p className="mt-1 text-sm text-neutral-500">
              {trip.start_date}
              {trip.start_date && trip.end_date ? " → " : ""}
              {trip.end_date}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <MemberAvatars members={members} currentUserId={currentUserId} />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {role === "owner" ? "Share & settings" : "Members"}
          </button>
        </div>
      </div>

      {/* Viewer read-only banner */}
      {!canEdit && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-neutral-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            You have <strong className="mx-1">view-only</strong> access to this
            trip.
          </div>
          <button
            type="button"
            onClick={handleRequestEdit}
            disabled={editRequested || isPending}
            className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {editRequested ? "Edit access requested" : "Request edit access"}
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {/* Day list */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Days
            </h2>
            <nav className="space-y-1" aria-label="Trip days">
              {trip.trip_days.map((day) => (
                <div key={day.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      selectedDayId === day.id
                        ? "bg-primary-600 text-white"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="font-semibold">Day {day.day_number}</span>
                    {day.label && (
                      <span
                        className={`ml-1.5 font-normal ${
                          selectedDayId === day.id
                            ? "text-white/80"
                            : "text-neutral-500"
                        }`}
                      >
                        · {day.label}
                      </span>
                    )}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDay(day.id)}
                      disabled={isPending}
                      aria-label={`Delete Day ${day.day_number}`}
                      className="hidden h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:flex disabled:opacity-50"
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
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {trip.trip_days.length === 0 && (
                <p className="px-3 py-2 text-sm text-neutral-400">
                  No days yet.
                </p>
              )}
            </nav>

            {/* Add day or upgrade prompt */}
            {canEdit && (
              <div className="mt-3">
                {atDayLimit || dayLimitHit ? (
                  <div className="rounded-xl border border-accent-200 bg-accent-50 p-3 text-xs text-accent-800">
                    <p className="font-semibold">5-day limit reached</p>
                    <p className="mt-1 text-accent-700">
                      Upgrade to Pro for unlimited days.
                    </p>
                    <a
                      href="/pricing"
                      className="mt-2 inline-block font-semibold text-accent-900 underline underline-offset-2"
                    >
                      Upgrade →
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddDay}
                    disabled={isPending}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:border-primary-400 hover:text-primary-700 disabled:opacity-50"
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
                    Add day
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Trip meta */}
          <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Trip info
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-500">Destination</dt>
                <dd className="font-medium text-neutral-900">
                  {trip.destination_name}
                  {trip.country ? `, ${trip.country}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Days planned</dt>
                <dd className="font-medium text-neutral-900">
                  {trip.trip_days.length} / {FREE_MAX_DAYS}{" "}
                  <span className="font-normal text-neutral-400">(free)</span>
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Status</dt>
                <dd className="font-medium capitalize text-neutral-900">
                  {trip.status}
                </dd>
              </div>
            </dl>
          </div>
        </aside>

        {/* ── Main area ───────────────────────────────────────────────────── */}
        <main>
          {selectedDay ? (
            <div>
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                  Day {selectedDay.day_number}
                  {selectedDay.label && (
                    <span className="ml-2 text-xl font-normal text-neutral-500">
                      · {selectedDay.label}
                    </span>
                  )}
                </h2>
                {selectedDay.date && (
                  <span className="text-sm text-neutral-500">
                    {new Date(selectedDay.date).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                )}
              </div>

              <div className="space-y-8">
                {TIME_SLOTS.map((slot) => {
                  const activities = selectedDay.activities.filter(
                    (a) =>
                      a.time_of_day === slot.key &&
                      !deletingActivityIds.has(a.id)
                  );
                  const isAddingHere =
                    addForm?.dayId === selectedDay.id &&
                    addForm.timeOfDay === slot.key;

                  return (
                    <section
                      key={slot.key}
                      aria-labelledby={`section-${slot.key}-${selectedDay.id}`}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span aria-hidden="true">{slot.icon}</span>
                        <h3
                          id={`section-${slot.key}-${selectedDay.id}`}
                          className="text-base font-semibold text-neutral-800"
                        >
                          {slot.label}
                        </h3>
                        <div
                          className="flex-1 border-t border-neutral-200"
                          aria-hidden="true"
                        />
                      </div>

                      <div className="space-y-2">
                        {activities.map((activity) => (
                          <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onDelete={() => handleDeleteActivity(activity.id)}
                            onUpdate={(data) =>
                              handleUpdateActivity(activity.id, data)
                            }
                            isPending={isPending}
                            readOnly={!canEdit}
                          />
                        ))}

                        {canEdit &&
                          activities.length === 0 &&
                          !isAddingHere && (
                            <p className="px-1 text-sm text-neutral-400">
                              Nothing planned yet.
                            </p>
                          )}
                        {!canEdit && activities.length === 0 && (
                          <p className="px-1 text-sm text-neutral-400">
                            Nothing planned for the {slot.label.toLowerCase()}.
                          </p>
                        )}

                        {/* Inline add form (editors only) */}
                        {canEdit && isAddingHere ? (
                          <form
                            onSubmit={handleAddActivity}
                            className="space-y-3 rounded-xl border border-primary-200 bg-primary-50 p-4"
                          >
                            <input
                              type="text"
                              placeholder={`${slot.label} activity…`}
                              value={addTitle}
                              onChange={(e) => setAddTitle(e.target.value)}
                              autoFocus
                              required
                              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <textarea
                              placeholder="Notes (optional)"
                              value={addNotes}
                              onChange={(e) => setAddNotes(e.target.value)}
                              rows={2}
                              className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={!addTitle.trim() || isPending}
                                className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddForm(null)}
                                className="rounded-lg px-4 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : canEdit ? (
                          <button
                            type="button"
                            onClick={() =>
                              openAddForm(selectedDay.id, slot.key)
                            }
                            className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
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
                            Add {slot.label.toLowerCase()} activity
                          </button>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Empty state — no days yet */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-20 text-center">
              <div className="text-4xl mb-4" aria-hidden="true">
                🗺️
              </div>
              <h2 className="text-xl font-bold text-neutral-900">
                {canEdit ? "Start building your itinerary" : "No itinerary yet"}
              </h2>
              <p className="mt-2 max-w-sm text-neutral-600">
                {canEdit
                  ? `Add your first day to begin planning. You can add up to ${FREE_MAX_DAYS} days on the free plan.`
                  : "The trip owner hasn't added any days yet. Check back soon."}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleAddDay}
                  disabled={isPending}
                  className="mt-6 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  + Add first day
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      <TripSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tripId={trip.id}
        role={role}
        isOwnerPro={isOwnerPro}
        members={members}
        invites={invites}
        currentUserId={currentUserId}
      />
    </div>
  );
}
