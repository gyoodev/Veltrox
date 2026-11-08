import { notFound } from "next/navigation";
import { VehicleDetailClient } from "@/components/car-diary/vehicle-detail-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";

interface VehiclePageProps {
  params: Promise<{ vehicleId: string }>;
}

export default async function VehicleDetailPage({ params }: VehiclePageProps) {
  const { vehicleId } = await params;
  const { profile } = await requireRole(["USER", "ADMIN"]);
  const bundle = await getUserDiaryBundle(profile.uid);

  const vehicle = bundle.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) {
    notFound();
  }

  const entries = bundle.diaryEntries.filter((e) => e.vehicleId === vehicleId);
  const reminders = bundle.reminders.filter((r) => r.vehicleId === vehicleId);
  const documents = bundle.documents.filter((d) => d.vehicleId === vehicleId);

  return (
    <VehicleDetailClient
      ownerUid={profile.uid}
      initialVehicle={vehicle}
      initialEntries={entries}
      initialReminders={reminders}
      initialDocuments={documents}
    />
  );
}

