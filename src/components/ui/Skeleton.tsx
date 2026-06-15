import { cn } from "@/lib/utils";

/** Animated placeholder block. Respects prefers-reduced-motion via globals.css. */
export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-neutral-200/70", className)}
      aria-hidden="true"
    />
  );
}
