import { AdminOverviewClient } from "@/components/admin/admin-overview-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminDashboardPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return <AdminOverviewClient bundle={bundle} />;
}
