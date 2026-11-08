import { notFound } from "next/navigation";
import { ServiceBookPrint } from "@/components/car-diary/service-book-print";
import { requireRole } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";
import { computeExpenseAnalytics } from "@/lib/diary-metrics";

interface ServiceBookPageProps {
  params: Promise<{ vehicleId: string }>;
}

export default async function VehicleServiceBookPage({
  params,
}: ServiceBookPageProps) {
  const { vehicleId } = await params;
  const { profile } = await requireRole(["USER"]);
  const bundle = await getUserDiaryBundle(profile.uid);

  const vehicle = bundle.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) {
    notFound();
  }

  const entries = bundle.diaryEntries.filter((e) => e.vehicleId === vehicleId);
  const analytics = computeExpenseAnalytics(entries, [vehicle]);

  return (
    <ServiceBookPrint
      vehicle={vehicle}
      owner={profile}
      entries={entries}
      totalInvestedEur={analytics.totalAmountEur}
    />
  );
}

