import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="container space-y-8 py-12">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    </div>
  );
}

