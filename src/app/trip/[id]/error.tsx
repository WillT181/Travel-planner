"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState title="Couldn't load this trip" error={error} reset={reset} />
  );
}
