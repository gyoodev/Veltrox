import "server-only";

import { getPublicPlatformCms } from "@/lib/data/platform-cms";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type {
  AppNotification,
  AuditLog,
  Garage,
  PlatformContentConfig,
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
  reminders: Reminder[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  cms: PlatformContentConfig;
}

/**
 * Loads authoritative multi-tenant collections for the ADMIN governance & analytics suite.
 * Every count and chart in `/admin/*` derives strictly from these real Firestore documents.
 */
export async function getAdminDashboardBundle(): Promise<AdminDashboardBundle> {
  const admin = getFirebaseAdmin();
  const cms = await getPublicPlatformCms();

  if (!admin) {
    return {
      users: [],
      garages: [],
      vehicles: [],
      workOrders: [],
      reminders: [],
      notifications: [],
      auditLogs: [],
      cms,
    };
  }

  const [
    usersSnap,
    garagesSnap,
    vehiclesSnap,
    workOrdersSnap,
    remindersSnap,
    notificationsSnap,
    auditLogsSnap,
  ] = await Promise.all([
    admin.adminDb.collection("users").get(),
    admin.adminDb.collection("garages").get(),
    admin.adminDb.collection("vehicles").get(),
    admin.adminDb.collection("workOrders").get(),
    admin.adminDb.collection("reminders").get(),
    admin.adminDb.collection("notifications").get(),
    admin.adminDb.collection("auditLogs").get(),
  ]);

  const users = usersSnap.docs
    .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const garages = garagesSnap.docs
    .map((d) => ({ ...(d.data() as Garage), id: d.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const vehicles = vehiclesSnap.docs.map((d) => ({
    ...(d.data() as Vehicle),
    id: d.id,
  }));

  const workOrders = workOrdersSnap.docs.map((d) => ({
    ...(d.data() as WorkOrder),
    id: d.id,
  }));

  const reminders = remindersSnap.docs.map((d) => ({
    ...(d.data() as Reminder),
    id: d.id,
  }));

  const notifications = notificationsSnap.docs.map((d) => ({
    ...(d.data() as AppNotification),
    id: d.id,
  }));

  const auditLogs = auditLogsSnap.docs
    .map((d) => ({ ...(d.data() as AuditLog), id: d.id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 300);

  return {
    users,
    garages,
    vehicles,
    workOrders,
    reminders,
    notifications,
    auditLogs,
    cms,
  };
}

