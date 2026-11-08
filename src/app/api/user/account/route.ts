import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  EDGE_SESSION_COOKIE,
  FB_SESSION_COOKIE,
} from "@/lib/auth/edge-session";
import { getCurrentAuthContext } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { deleteAccountSchema } from "@/lib/validators/profile";

export const runtime = "nodejs";

async function purgeDocumentsByField(
  db: Firestore,
  collectionName: string,
  field: string,
  value: string
): Promise<number> {
  let totalDeleted = 0;
  while (true) {
    const snap = await db
      .collection(collectionName)
      .where(field, "==", value)
      .limit(400)
      .get();

    if (snap.empty) {
      break;
    }

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snap.size;

    if (snap.size < 400) {
      break;
    }
  }
  return totalDeleted;
}

/**
 * DELETE /api/user/account
 * GDPR Right to Erasure (Article 17):
 * 1. Validates explicit user confirmation ("DELETE" / "ИЗТРИЙ").
 * 2. Purges all user-owned Firestore documents across multi-tenant collections.
 * 3. Deletes uploaded Firebase Storage files (`users/{uid}/**` & `vehicles/{uid}/**`).
 * 4. Writes a non-PII anonymized audit log entry (`GDPR_ACCOUNT_DELETED`).
 * 5. Deletes `users/{uid}` and removes the Firebase Authentication account.
 * 6. Clears all session cookies.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = deleteAccountSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const uid = ctx.session.uid;
  const userRole = ctx.profile.role;

  try {
    const ownerCollections = [
      "vehicles",
      "diaryEntries",
      "reminders",
      "documents",
      "appointments",
      "notifications",
    ] as const;

    let deletedRecordsCount = 0;
    for (const col of ownerCollections) {
      deletedRecordsCount += await purgeDocumentsByField(
        admin.adminDb,
        col,
        "ownerId",
        uid
      );
    }

    // Remove staff memberships tied to this UID
    deletedRecordsCount += await purgeDocumentsByField(
      admin.adminDb,
      "garageStaff",
      "uid",
      uid
    );

    // If caller is a Garage Owner (manager), purge their owned garage & tenant records
    const ownedGarageId =
      userRole === "GARAGE_OWNER" && !ctx.profile.isStaff
        ? ctx.profile.garageId
        : null;

    if (ownedGarageId) {
      const woSnap = await admin.adminDb
        .collection("workOrders")
        .where("garageId", "==", ownedGarageId)
        .get();
      for (const woDoc of woSnap.docs) {
        const token = woDoc.data().publicStatusToken as string | undefined;
        if (token) {
          await admin.adminDb
            .collection("workOrderPublicStatus")
            .doc(token)
            .delete();
        }
      }

      const garageCollections = [
        "customers",
        "workOrders",
        "workOrderItems",
        "tyreSets",
        "garageStaff",
        "reminders",
        "appointments",
        "notifications",
      ] as const;

      for (const col of garageCollections) {
        deletedRecordsCount += await purgeDocumentsByField(
          admin.adminDb,
          col,
          "garageId",
          ownedGarageId
        );
      }

      await admin.adminDb.collection("garages").doc(ownedGarageId).delete();
      deletedRecordsCount += 1;
    }

    // Delete Storage files under user-owned and garage-owned prefixes
    try {
      const bucket = admin.adminStorage.bucket();
      await Promise.all([
        bucket.deleteFiles({ prefix: `users/${uid}/`, force: true }),
        bucket.deleteFiles({ prefix: `vehicles/${uid}/`, force: true }),
        ...(ownedGarageId
          ? [bucket.deleteFiles({ prefix: `garages/${ownedGarageId}/`, force: true })]
          : []),
      ]);
    } catch {
      // Continue erasure if storage bucket has no matching objects
    }

    // Delete user profile document
    await admin.adminDb.collection("users").doc(uid).delete();

    // Record anonymized GDPR erasure event (zero PII retained)
    const nowIso = new Date().toISOString();
    await admin.adminDb.collection("auditLogs").add({
      action: "GDPR_ACCOUNT_DELETED",
      actorUid: "redacted-self-erasure",
      actorRole: userRole,
      targetUid: null,
      targetGarageId: null,
      metadata: {
        purgedDocumentCount: deletedRecordsCount + 1,
      },
      createdAt: nowIso,
      serverTimestamp: FieldValue.serverTimestamp(),
    });

    // Delete Firebase Authentication user record
    await admin.adminAuth.deleteUser(uid);

    const response = NextResponse.json({ deleted: true });
    response.cookies.delete(FB_SESSION_COOKIE);
    response.cookies.delete(EDGE_SESSION_COOKIE);
    return response;
  } catch (err: unknown) {
    console.error("[DELETE /api/user/account] Error:", err);
    return NextResponse.json(
      { error: "ACCOUNT_DELETION_FAILED" },
      { status: 500 }
    );
  }
}

