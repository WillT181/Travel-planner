import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="text-4xl" aria-hidden="true">
        🗺️
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
        Page not found
      </h1>
      <p className="mt-2 text-neutral-600">
        We couldn&apos;t find the page you were looking for. It may have moved
        or never existed.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          Back home
        </Link>
        <Link
          href="/explore"
          className={buttonVariants({ variant: "secondary" })}
        >
          Explore destinations
        </Link>
      </div>
    </div>
  );
}
