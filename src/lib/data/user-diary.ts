import "server-only";

import {
  computeExpenseAnalytics,
  type ExpenseAnalyticsSummary,
} from "@/lib/diary-metrics";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { toPlainDoc } from "@/lib/firebase/serialize";
import type {
  DiaryEntry,
  Garage,
  Reminder,
  Vehicle,
  VehicleDocument,
} from "@/types/domain";

export interface UserDiaryBundle {
  vehicles: Vehicle[];
  diaryEntries: DiaryEntry[];
  reminders: Reminder[];
  documents: VehicleDocument[];
  expenses: ExpenseAnalyticsSummary;
}

/**
 * Loads all user-owned Car Diary collections (`vehicles`, `diaryEntries`,
 * `reminders`, `documents`) using single-field `ownerId == uid` queries so they
 * work immediately without requiring pre-built composite indexes.
 */
export async function getUserDiaryBundle(
  uid: string
): Promise<UserDiaryBundle> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      vehicles: [],
      diaryEntries: [],
      reminders: [],
      documents: [],
      expenses: computeExpenseAnalytics([], []),
    };
  }

  const [vehiclesSnap, diarySnap, remindersSnap, docsSnap] = await Promise.all([
    admin.adminDb.collection("vehicles").where("ownerId", "==", uid).get(),
    admin.adminDb.collection("diaryEntries").where("ownerId", "==", uid).get(),
    admin.adminDb.collection("reminders").where("ownerId", "==", uid).get(),
    admin.adminDb.collection("documents").where("ownerId", "==", uid).get(),
  ]);

  const vehicles = vehiclesSnap.docs
    .map((d) => toPlainDoc<Vehicle & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

  const diaryEntries = diarySnap.docs
    .map((d) => toPlainDoc<DiaryEntry & Record<string, unknown>>(d))
    .sort((a, b) => {
      const byDate = String(b.date ?? "").localeCompare(String(a.date ?? ""));
      return byDate !== 0
        ? byDate
        : String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    });

  const reminders = remindersSnap.docs
    .map((d) => toPlainDoc<Reminder & Record<string, unknown>>(d))
    .sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      const dateA = a.dueDate ?? "9999-12-31";
      const dateB = b.dueDate ?? "9999-12-31";
      return dateA.localeCompare(dateB);
    });

  const documents = docsSnap.docs
    .map((d) => toPlainDoc<VehicleDocument & Record<string, unknown>>(d))
    .sort((a, b) => {
      const expA = a.expiryDate ?? "9999-12-31";
      const expB = b.expiryDate ?? "9999-12-31";
      return expA.localeCompare(expB);
    });

  const expenses = computeExpenseAnalytics(diaryEntries, vehicles);

  return {
    vehicles,
    diaryEntries,
    reminders,
    documents,
    expenses,
  };
}

export async function getApprovedGarages(): Promise<Garage[]> {
  const admin = getFirebaseAdmin();
  if (!admin) return [];

  const snap = await admin.adminDb
    .collection("garages")
    .where("status", "==", "approved")
    .get();

  return snap.docs
    .map((doc) => toPlainDoc<Garage & Record<string, unknown>>(doc))
    .sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""))
    );
}

export async function getApprovedGarageBySlug(
  slug: string
): Promise<Garage | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  const snap = await admin.adminDb
    .collection("garages")
    .where("slug", "==", slug)
    .limit(5)
    .get();

  const match = snap.docs
    .map((doc) => toPlainDoc<Garage & Record<string, unknown>>(doc))
    .find((g) => g.status === "approved");

  return match ?? null;
}
