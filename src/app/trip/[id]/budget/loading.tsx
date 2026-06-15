import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="py-6">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-6 h-10 w-56" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
    </div>
  );
}
