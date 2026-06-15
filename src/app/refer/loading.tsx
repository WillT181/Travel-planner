import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-full max-w-md" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      <Skeleton className="mt-8 h-40 w-full rounded-2xl" />
    </div>
  );
}
