import { Navbar } from "@/components/marketing/navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function GaragesPublicLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="container flex-1 space-y-8 py-12 sm:py-16">
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl sm:w-56" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </main>
    </div>
  );
}

