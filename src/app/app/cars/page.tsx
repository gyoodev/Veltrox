import { VehiclesGridClient } from "@/components/car-diary/vehicles-grid-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";

export default async function MyCarsPage() {
  const { profile } = await requireRole(["USER", "ADMIN"]);
  const bundle = await getUserDiaryBundle(profile.uid);

  return (
    <VehiclesGridClient
      ownerUid={profile.uid}
      initialVehicles={bundle.vehicles}
    />
  );
}

