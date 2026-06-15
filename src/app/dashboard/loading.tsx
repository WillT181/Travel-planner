import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <Skeleton className="mt-6 h-16 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-64 w-full rounded-3xl" />

      <Skeleton className="mt-10 h-6 w-32" />
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
