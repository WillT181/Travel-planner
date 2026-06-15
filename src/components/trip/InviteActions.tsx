"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite, declineInvite } from "@/lib/trips/collaboration";

export default function InviteActions({
  token,
  destinationName,
  role,
}: {
  token: string;
  destinationName: string;
  role: "editor" | "viewer";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/trip/${result.tripId}`);
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      const result = await declineInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeclined(true);
    });
  }

  if (declined) {
    return (
      <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
        You&apos;ve declined this invitation. No worries — you can ask for a new
        link any time.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          className="flex-1 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {isPending ? "Joining…" : `Join as ${role}`}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={isPending}
          className="rounded-xl border border-neutral-300 px-6 py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-3 text-center text-xs text-neutral-400">
        Joining {destinationName} as {role}.
      </p>
    </div>
  );
}
