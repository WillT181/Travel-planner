import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="py-6">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-6 h-10 w-64" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
