import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/server-auth";

export default async function UserWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireRole(["USER", "ADMIN"]);

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}

