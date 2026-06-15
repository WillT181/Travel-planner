import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-md py-16">
      <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  );
}
