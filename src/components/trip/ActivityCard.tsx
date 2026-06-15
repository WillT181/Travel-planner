"use client";

import { useState } from "react";
import type { Activity } from "@/types/trip";

interface Props {
  activity: Activity;
  onDelete: () => void;
  onUpdate: (data: {
    title?: string;
    notes?: string;
    durationMins?: number;
  }) => void;
  isPending: boolean;
  readOnly?: boolean;
}

export default function ActivityCard({
  activity,
  onDelete,
  onUpdate,
  isPending,
  readOnly = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [notes, setNotes] = useState(activity.notes ?? "");
  const [duration, setDuration] = useState(
    activity.duration_mins?.toString() ?? ""
  );

  function handleSave() {
    if (!title.trim()) return;
    onUpdate({
      title,
      notes,
      durationMins: duration ? parseInt(duration, 10) : undefined,
    });
    setEditing(false);
  }

  function handleCancel() {
    setTitle(activity.title);
    setNotes(activity.notes ?? "");
    setDuration(activity.duration_mins?.toString() ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor={`dur-${activity.id}`}
              className="whitespace-nowrap text-xs text-neutral-500"
            >
              Duration (min)
            </label>
            <input
              id={`dur-${activity.id}`}
              type="number"
              min={0}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim() || isPending}
              className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-neutral-900">
          {activity.title}
        </p>
        {activity.notes && (
          <p className="mt-1 text-sm leading-snug text-neutral-500">
            {activity.notes}
          </p>
        )}
        {activity.duration_mins != null && (
          <p className="mt-1 text-xs text-neutral-400">
            {activity.duration_mins} min
          </p>
        )}
      </div>
      {readOnly ? null : (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit activity"
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
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
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            aria-label="Delete activity"
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}
