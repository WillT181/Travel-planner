import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-56" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
