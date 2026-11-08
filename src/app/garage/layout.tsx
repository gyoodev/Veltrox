import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/server-auth";

export default async function GarageWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireRole(["GARAGE_OWNER"]);

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}

