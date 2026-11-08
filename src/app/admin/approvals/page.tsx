import {
  ApprovalsQueueClient,
  type GarageApplicantRow,
} from "@/components/admin/approvals-queue-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminApprovalsPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  const garageByOwnerUid = new Map(
    bundle.garages.map((g) => [g.ownerUid, g])
  );
  const garageById = new Map(bundle.garages.map((g) => [g.id, g]));

  const rows: GarageApplicantRow[] = bundle.users
    .filter((u) => u.role === "GARAGE_OWNER" && !u.isStaff)
    .map((user) => ({
      user,
      garage:
        (user.garageId ? garageById.get(user.garageId) : null) ??
        garageByOwnerUid.get(user.uid) ??
        null,
    }));

  return <ApprovalsQueueClient initialRows={rows} />;
}

