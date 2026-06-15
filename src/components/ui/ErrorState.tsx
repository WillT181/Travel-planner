"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button, { buttonVariants } from "@/components/ui/Button";

/**
 * Friendly fallback for route-segment error boundaries. Logs the error and
 * offers a retry plus an escape hatch back to the dashboard.
 */
export default function ErrorState({
  title = "Something went wrong",
  description = "We hit a snag loading this page. Please try again — if it keeps happening, head back and start fresh.",
  error,
  reset,
  homeHref = "/dashboard",
  homeLabel = "Back to dashboard",
}: {
  title?: string;
  description?: string;
  error?: Error & { digest?: string };
  reset?: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="text-4xl" aria-hidden="true">
        🧭
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
        {title}
      </h1>
      <p className="mt-2 text-neutral-600">{description}</p>
      <div className="mt-6 flex gap-3">
        {reset ? <Button onClick={reset}>Try again</Button> : null}
        <Link
          href={homeHref}
          className={buttonVariants({ variant: "secondary" })}
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
