import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { toPlainFirestoreData } from "@/lib/firebase/serialize";
import type { InventoryPart } from "@/types/domain";

export async function getGarageInventoryParts(
  garageId: string
): Promise<InventoryPart[]> {
  const admin = getFirebaseAdmin();
  if (!admin) return [];

  const snap = await admin.adminDb
    .collection("inventoryParts")
    .where("garageId", "==", garageId)
    .get();

  return snap.docs
    .map((d) =>
      toPlainFirestoreData({
        ...(d.data() as InventoryPart),
        id: d.id,
      })
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

