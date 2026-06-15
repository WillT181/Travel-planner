"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { createTrip } from "@/lib/trips/actions";

export default function StartPlanningButton({ slug }: { slug: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      // On success the action redirects; only errors return here.
      const result = await createTrip(slug);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div>
      <Button size="lg" onClick={handleClick} disabled={isPending}>
        {isPending ? "Starting your trip…" : "Start planning this trip"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
