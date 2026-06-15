import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="py-12">
      <div className="mx-auto max-w-2xl text-center">
        <Skeleton className="mx-auto h-10 w-80" />
        <Skeleton className="mx-auto mt-4 h-4 w-full max-w-lg" />
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    </div>
  );
}
