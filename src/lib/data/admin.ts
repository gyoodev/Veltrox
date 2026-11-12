import "server-only";

import { getPublicPlatformCms } from "@/lib/data/platform-cms";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { toPlainDoc } from "@/lib/firebase/serialize";
import type {
  Appointment,
  AppNotification,
  AuditLog,
  Garage,
  PlatformContentConfig,
  PlatformSettingsConfig,
  Reminder,
  UserProfile,
  Vehicle,
  WorkOrder,
} from "@/types/domain";

export interface AdminDashboardBundle {
  users: UserProfile[];
  garages: Garage[];
  vehicles: Vehicle[];
  workOrders: WorkOrder[];
  appointments: Appointment[];
  reminders: Reminder[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  cms: PlatformContentConfig;
  settings: PlatformSettingsConfig;
}

/**
 * Loads authoritative multi-tenant collections for the ADMIN governance & analytics suite.
 * Every count and chart in `/admin/*` derives strictly from these real Firestore documents.
 */
export async function getAdminDashboardBundle(): Promise<AdminDashboardBundle> {
  const admin = getFirebaseAdmin();
  const [cms, settings] = await Promise.all([
    getPublicPlatformCms(),
    getPlatformSettings(),
  ]);

  if (!admin) {
    return {
      users: [],
      garages: [],
      vehicles: [],
      workOrders: [],
      appointments: [],
      reminders: [],
      notifications: [],
      auditLogs: [],
      cms,
      settings,
    };
  }

  const [
    usersSnap,
    garagesSnap,
    vehiclesSnap,
    workOrdersSnap,
    appointmentsSnap,
    remindersSnap,
    notificationsSnap,
    auditLogsSnap,
  ] = await Promise.all([
    admin.adminDb.collection("users").get(),
    admin.adminDb.collection("garages").get(),
    admin.adminDb.collection("vehicles").get(),
    admin.adminDb.collection("workOrders").get(),
    admin.adminDb.collection("appointments").get(),
    admin.adminDb.collection("reminders").get(),
    admin.adminDb.collection("notifications").get(),
    admin.adminDb.collection("auditLogs").get(),
  ]);

  const users = usersSnap.docs
    .map((d) => toPlainDoc<UserProfile & Record<string, unknown>>(d, "uid"))
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

  const garages = garagesSnap.docs
    .map((d) => toPlainDoc<Garage & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

  const vehicles = vehiclesSnap.docs.map((d) =>
    toPlainDoc<Vehicle & Record<string, unknown>>(d)
  );

  const workOrders = workOrdersSnap.docs.map((d) =>
    toPlainDoc<WorkOrder & Record<string, unknown>>(d)
  );

  const appointments = appointmentsSnap.docs.map((d) =>
    toPlainDoc<Appointment & Record<string, unknown>>(d)
  );

  const reminders = remindersSnap.docs.map((d) =>
    toPlainDoc<Reminder & Record<string, unknown>>(d)
  );

  const notifications = notificationsSnap.docs.map((d) =>
    toPlainDoc<AppNotification & Record<string, unknown>>(d)
  );

  const auditLogs = auditLogsSnap.docs
    .map((d) => {
      const plain = toPlainDoc<
        AuditLog & Record<string, unknown> & { serverTimestamp?: unknown }
      >(d);
      // Omit raw serverTimestamp mirror field if createdAt is already present
      const { serverTimestamp: _omit, ...rest } = plain;
      void _omit;
      return rest as AuditLog;
    })
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    )
    .slice(0, 300);

  return {
    users,
    garages,
    vehicles,
    workOrders,
    appointments,
    reminders,
    notifications,
    auditLogs,
    cms,
    settings,
  };
}

