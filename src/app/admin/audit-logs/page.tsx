import { AuditLogsClient } from "@/components/admin/audit-logs-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getAdminDashboardBundle } from "@/lib/data/admin";

export default async function AdminAuditLogsPage() {
  await requireRole(["ADMIN"]);
  const bundle = await getAdminDashboardBundle();

  return <AuditLogsClient logs={bundle.auditLogs} />;
}

