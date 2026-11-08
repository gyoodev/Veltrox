import { UsersGovernanceClient } from "@/components/admin/users-governance-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminUsersGovernancePage() {
  const { session } = await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return (
    <UsersGovernanceClient
      currentAdminUid={session.uid}
      initialUsers={bundle.users}
      garages={bundle.garages}
    />
  );
}

