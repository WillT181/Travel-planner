"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { destinationImage } from "@/data/destinations";
import { deleteTrip, duplicateTrip } from "@/lib/trips/actions";
import { buttonVariants } from "@/components/ui/Button";

export interface TripCardData {
  id: string;
  destinationName: string;
  country: string | null;
  imageSeed: string;
  dateRange: string | null;
  displayStatus: "Planning" | "Upcoming" | "Completed";
  score: number;
}

const STATUS_STYLES: Record<TripCardData["displayStatus"], string> = {
  Planning: "bg-neutral-100 text-neutral-600",
  Upcoming: "bg-primary-50 text-primary-700",
  Completed: "bg-accent-100 text-accent-700",
};

export default function TripCard({ trip }: { trip: TripCardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (removed) return null;

  function handleDuplicate() {
    setError(null);
    startTransition(async () => {
      const result = await duplicateTrip(trip.id);
      // Success path redirects server-side; only errors return here.
      if (result?.error) setError(result.error);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteTrip(trip.id);
      if (result?.error) {
        setError(result.error);
        setConfirmingDelete(false);
        return;
      }
      setRemoved(true);
      router.refresh();
    });
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={destinationImage(trip.imageSeed, 640, 360)}
          alt={`${trip.destinationName}${trip.country ? `, ${trip.country}` : ""}`}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[trip.displayStatus]}`}
        >
          {trip.displayStatus}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold text-neutral-900">{trip.destinationName}</h3>
        {trip.country ? (
          <p className="text-sm text-neutral-500">{trip.country}</p>
        ) : null}
        <p className="mt-1 text-xs text-neutral-500">
          {trip.dateRange ?? "Dates not set"}
        </p>

        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"
            role="progressbar"
            aria-valuenow={trip.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Trip completion"
          >
            <div
              className="h-full rounded-full bg-primary-600"
              style={{ width: `${trip.score}%` }}
            />
          </div>
          <span className="text-xs font-medium text-neutral-500">
            {trip.score}%
          </span>
        </div>

        {error ? (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/trip/${trip.id}`}
            className={buttonVariants({
              variant: "primary",
              size: "sm",
              className: "flex-1",
            })}
          >
            Open
          </Link>
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isPending}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Duplicate
          </button>
          {confirmingDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className={buttonVariants({ variant: "danger", size: "sm" })}
            >
              {isPending ? "Deleting…" : "Confirm"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
              aria-label={`Delete trip to ${trip.destinationName}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
