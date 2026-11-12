import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { toPlainDoc, toPlainFirestoreData } from "@/lib/firebase/serialize";
import { maskLicensePlate } from "@/lib/garage-utils";
import { normalizeLicensePlate } from "@/lib/validators/entities";
import type {
  Appointment,
  Customer,
  DiaryEntry,
  Garage,
  GarageStaff,
  Reminder,
  TyreSet,
  Vehicle,
  WorkOrder,
  WorkOrderItem,
  WorkOrderPublicStatus,
} from "@/types/domain";

export interface GarageWorkspaceBundle {
  customers: Customer[];
  workOrders: WorkOrder[];
  appointments: Appointment[];
  tyreSets: TyreSet[];
  staff: GarageStaff[];
  reminders: Reminder[];
}

/**
 * Loads all multi-tenant collections belonging to `garageId` using single-field
 * equality queries so they work out of the box without composite index delays.
 */
export async function getGarageWorkspaceBundle(
  garageId: string
): Promise<GarageWorkspaceBundle> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      customers: [],
      workOrders: [],
      appointments: [],
      tyreSets: [],
      staff: [],
      reminders: [],
    };
  }

  const [
    customersSnap,
    workOrdersSnap,
    appointmentsSnap,
    tyresSnap,
    staffSnap,
    remindersSnap,
  ] = await Promise.all([
    admin.adminDb
      .collection("customers")
      .where("garageId", "==", garageId)
      .get(),
    admin.adminDb
      .collection("workOrders")
      .where("garageId", "==", garageId)
      .get(),
    admin.adminDb
      .collection("appointments")
      .where("garageId", "==", garageId)
      .get(),
    admin.adminDb
      .collection("tyreSets")
      .where("garageId", "==", garageId)
      .get(),
    admin.adminDb
      .collection("garageStaff")
      .where("garageId", "==", garageId)
      .get(),
    admin.adminDb
      .collection("reminders")
      .where("garageId", "==", garageId)
      .get(),
  ]);

  const customers = customersSnap.docs
    .map((d) => toPlainDoc<Customer & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(b.lastVisitAt ?? b.createdAt ?? "").localeCompare(
        String(a.lastVisitAt ?? a.createdAt ?? "")
      )
    );

  const workOrders = workOrdersSnap.docs
    .map((d) => toPlainDoc<WorkOrder & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

  const appointments = appointmentsSnap.docs
    .map((d) => toPlainDoc<Appointment & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(a.scheduledStart ?? "").localeCompare(String(b.scheduledStart ?? ""))
    );

  const tyreSets = tyresSnap.docs
    .map((d) => toPlainDoc<TyreSet & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(b.storedAt ?? "").localeCompare(String(a.storedAt ?? ""))
    );

  const staff = staffSnap.docs
    .map((d) => toPlainDoc<GarageStaff & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

  const reminders = remindersSnap.docs
    .map((d) => toPlainDoc<Reminder & Record<string, unknown>>(d))
    .sort((a, b) =>
      String(a.dueDate ?? "9999-12-31").localeCompare(
        String(b.dueDate ?? "9999-12-31")
      )
    );

  return {
    customers,
    workOrders,
    appointments,
    tyreSets,
    staff,
    reminders,
  };
}

export interface LinkedVehicleMatch {
  vehicleId: string;
  ownerId: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  linkState: "linked" | "pending" | "unlinked";
}

/**
 * Checks whether a normalized license plate corresponds to a registered Car Owner's
 * `Vehicle` in Veltrox, returning only non-sensitive metadata and link state.
 */
export async function findRegisteredVehicleByPlate(
  garageId: string,
  rawPlate: string
): Promise<LinkedVehicleMatch | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  const norm = normalizeLicensePlate(rawPlate);
  if (!norm) return null;

  const snap = await admin.adminDb
    .collection("vehicles")
    .where("plateNormalized", "==", norm)
    .limit(3)
    .get();

  const doc = snap.docs[0];
  if (!doc) return null;

  const v = { ...(doc.data() as Vehicle), id: doc.id };
  const isLinked = (v.linkedGarageIds ?? []).includes(garageId);
  const isPending = (v.pendingGarageLinks ?? []).some(
    (p) => p.garageId === garageId
  );

  return {
    vehicleId: v.id,
    ownerId: v.ownerId,
    make: v.make,
    model: v.model,
    year: v.year,
    plateNumber: v.plateNumber,
    linkState: isLinked ? "linked" : isPending ? "pending" : "unlinked",
  };
}

export async function getWorkOrderDetail(
  garageId: string,
  workOrderId: string
): Promise<{
  workOrder: WorkOrder;
  items: WorkOrderItem[];
  customer: Customer | null;
  vehicleMatch: LinkedVehicleMatch | null;
} | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  const woSnap = await admin.adminDb
    .collection("workOrders")
    .doc(workOrderId)
    .get();
  if (!woSnap.exists) return null;

  const workOrder = toPlainDoc<WorkOrder & Record<string, unknown>>(woSnap);
  if (workOrder.garageId !== garageId) return null;

  const [itemsSnap, customerSnap, vehicleMatch] = await Promise.all([
    admin.adminDb
      .collection("workOrderItems")
      .where("workOrderId", "==", workOrderId)
      .get(),
    workOrder.customerId
      ? admin.adminDb.collection("customers").doc(workOrder.customerId).get()
      : Promise.resolve(null),
    findRegisteredVehicleByPlate(garageId, workOrder.plateNumber),
  ]);

  const items = itemsSnap.docs
    .map((d) => toPlainDoc<WorkOrderItem & Record<string, unknown>>(d))
    .filter((i) => i.garageId === garageId)
    .sort((a, b) =>
      String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
    );

  const customer =
    customerSnap && customerSnap.exists
      ? toPlainDoc<Customer & Record<string, unknown>>(customerSnap)
      : null;

  return {
    workOrder,
    items,
    customer: customer?.garageId === garageId ? customer : null,
    vehicleMatch,
  };
}

export async function getCustomerDetail(
  garageId: string,
  customerId: string
): Promise<{
  customer: Customer;
  workOrders: WorkOrder[];
  tyreSets: TyreSet[];
  vehicleMatches: Record<string, LinkedVehicleMatch | null>;
} | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  const custSnap = await admin.adminDb
    .collection("customers")
    .doc(customerId)
    .get();
  if (!custSnap.exists) return null;

  const customer = toPlainDoc<Customer & Record<string, unknown>>(custSnap);
  if (customer.garageId !== garageId) return null;

  const normPlates = new Set(
    customer.plateNumbers.map((p) => normalizeLicensePlate(p))
  );

  const [woSnap, tyresSnap] = await Promise.all([
    admin.adminDb
      .collection("workOrders")
      .where("garageId", "==", garageId)
      .get(),
    admin.adminDb
      .collection("tyreSets")
      .where("garageId", "==", garageId)
      .get(),
  ]);

  const workOrders = woSnap.docs
    .map((d) => toPlainDoc<WorkOrder & Record<string, unknown>>(d))
    .filter(
      (wo) =>
        wo.customerId === customerId || normPlates.has(wo.plateNormalized)
    )
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );

  const tyreSets = tyresSnap.docs
    .map((d) => toPlainDoc<TyreSet & Record<string, unknown>>(d))
    .filter(
      (ts) =>
        ts.customerId === customerId || normPlates.has(ts.plateNormalized)
    )
    .sort((a, b) =>
      String(b.storedAt ?? "").localeCompare(String(a.storedAt ?? ""))
    );

  const vehicleMatches: Record<string, LinkedVehicleMatch | null> = {};
  await Promise.all(
    customer.plateNumbers.map(async (plate) => {
      vehicleMatches[plate] = await findRegisteredVehicleByPlate(
        garageId,
        plate
      );
    })
  );

  return {
    customer,
    workOrders,
    tyreSets,
    vehicleMatches,
  };
}

export async function getPublicWorkOrderStatus(
  token: string
): Promise<WorkOrderPublicStatus | null> {
  const admin = getFirebaseAdmin();
  if (!admin || !token || token.length < 12) return null;

  const snap = await admin.adminDb
    .collection("workOrderPublicStatus")
    .doc(token)
    .get();

  if (!snap.exists) return null;
  return toPlainFirestoreData(snap.data() as WorkOrderPublicStatus);
}

/**
 * Writes/updates the GDPR-whitelisted `workOrderPublicStatus/{token}` document.
 * Strictly omits customer personal details and internal mechanic notes.
 */
export async function syncPublicWorkOrderProjection(
  garage: Garage,
  workOrder: WorkOrder,
  items: readonly WorkOrderItem[]
): Promise<void> {
  const admin = getFirebaseAdmin();
  if (!admin) return;

  const projection: WorkOrderPublicStatus = {
    token: workOrder.publicStatusToken,
    workOrderId: workOrder.id,
    garageName: garage.name,
    garageSlug: garage.slug,
    garagePhone: garage.phone,
    garageAddress: garage.address,
    garageCity: garage.city,
    garageLogoUrl: garage.logoUrl,
    maskedPlate: maskLicensePlate(workOrder.plateNumber),
    vehicleLabel: workOrder.vehicleLabel,
    mileageKm: workOrder.mileageKm,
    status: workOrder.status,
    customerSummary: workOrder.customerSummary,
    lineItems: items.map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    totalLaborAmount: workOrder.totalLaborAmount,
    totalPartsAmount: workOrder.totalPartsAmount,
    totalAmount: workOrder.totalAmount,
    currency: workOrder.currency,
    dropOffPhotoUrls: workOrder.dropOffPhotoUrls,
    nextServiceDate: workOrder.nextServiceDate,
    nextServiceMileageKm: workOrder.nextServiceMileageKm,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
  };

  await admin.adminDb
    .collection("workOrderPublicStatus")
    .doc(workOrder.publicStatusToken)
    .set(projection);
}

/**
 * Automatically synchronizes a completed WorkOrder into the Car Owner's `diaryEntries`
 * when the vehicle owner has accepted the garage link (`garage.id in vehicle.linkedGarageIds`).
 */
export async function syncCompletedWorkOrderToCarDiary(
  garage: Garage,
  workOrder: WorkOrder,
  items: readonly WorkOrderItem[]
): Promise<string | null> {
  const admin = getFirebaseAdmin();
  if (!admin || workOrder.status !== "completed") return null;

  const snap = await admin.adminDb
    .collection("vehicles")
    .where("plateNormalized", "==", workOrder.plateNormalized)
    .limit(3)
    .get();

  const vehicleDoc = snap.docs.find((d) => {
    const v = d.data() as Vehicle;
    return (v.linkedGarageIds ?? []).includes(garage.id);
  });

  if (!vehicleDoc) return null;

  const vehicle = { ...(vehicleDoc.data() as Vehicle), id: vehicleDoc.id };
  const entryId = workOrder.syncedDiaryEntryId || `wo_${workOrder.id}`;
  const nowIso = new Date().toISOString();

  const itemLines = items
    .map(
      (i) =>
        `• ${i.description} (${i.quantity} × ${i.unitPrice.toFixed(2)} ${workOrder.currency})`
    )
    .join("\n");

  const combinedNotes = [workOrder.customerSummary, itemLines]
    .filter(Boolean)
    .join("\n\n");

  const resolvedMileage =
    workOrder.mileageKm && workOrder.mileageKm > 0
      ? workOrder.mileageKm
      : vehicle.currentMileageKm;

  const entry: DiaryEntry = {
    id: entryId,
    ownerId: vehicle.ownerId,
    vehicleId: vehicle.id,
    garageId: garage.id,
    garageName: garage.name,
    workOrderId: workOrder.id,
    category: "service",
    title:
      workOrder.customerSummary?.split("\n")[0]?.slice(0, 110) ||
      `${garage.name} — Service`,
    notes: combinedNotes || null,
    date: (workOrder.completedAt ?? nowIso).slice(0, 10),
    mileageKm: resolvedMileage,
    costAmount: workOrder.totalAmount,
    currency: workOrder.currency,
    attachmentUrls: workOrder.dropOffPhotoUrls,
    attachments: workOrder.dropOffPhotos ?? [],
    createdAt: workOrder.createdAt,
    updatedAt: nowIso,
  };

  await admin.adminDb.collection("diaryEntries").doc(entryId).set(entry);

  if (resolvedMileage > vehicle.currentMileageKm) {
    await vehicleDoc.ref.update({
      currentMileageKm: resolvedMileage,
      updatedAt: nowIso,
    });
  }

  return entryId;
}

export async function getGarageWorkOrderItems(
  garageId: string
): Promise<WorkOrderItem[]> {
  const admin = getFirebaseAdmin();
  if (!admin) return [];

  const snap = await admin.adminDb
    .collection("workOrderItems")
    .where("garageId", "==", garageId)
    .get();

  return snap.docs.map((d) =>
    toPlainDoc<WorkOrderItem & Record<string, unknown>>(d)
  );
}

