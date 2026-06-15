import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <Skeleton className="mt-8 h-56 w-full rounded-2xl" />
    </div>
  );
}
