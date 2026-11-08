/**
 * CLI Utility: Approve a pending GARAGE_OWNER account locally before Phase 6 Admin UI.
 *
 * Usage:
 *   npm run approve-garage -- garage@example.com
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const target = process.argv[2]?.trim();
  if (!target) {
    console.error("Usage: npm run approve-garage -- <email-or-uid>");
    process.exit(1);
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in .env.local."
    );
    process.exit(1);
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

  const auth = getAuth(app);
  const db = getFirestore(app);

  const userRecord = target.includes("@")
    ? await auth.getUserByEmail(target)
    : await auth.getUser(target);

  const existingClaims = userRecord.customClaims ?? {};
  await auth.setCustomUserClaims(userRecord.uid, {
    ...existingClaims,
    role: "GARAGE_OWNER",
    garageStatus: "approved",
  });

  const nowIso = new Date().toISOString();
  await db
    .collection("users")
    .doc(userRecord.uid)
    .set(
      {
        role: "GARAGE_OWNER",
        garageStatus: "approved",
        garageRejectionReason: null,
        updatedAt: nowIso,
      },
      { merge: true }
    );

  await db.collection("auditLogs").add({
    action: "GARAGE_APPROVED",
    actorUid: "cli-bootstrap",
    actorRole: "ADMIN",
    targetUid: userRecord.uid,
    targetGarageId: (existingClaims.garageId as string | undefined) ?? null,
    metadata: {
      method: "scripts/approve-garage.ts",
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  console.log(
    `Success: ${userRecord.email ?? userRecord.uid} is now an APPROVED GARAGE_OWNER.`
  );
  console.log("Sign out and sign back in to open the Garage Onboarding Wizard.");
}

main().catch((err: unknown) => {
  console.error("Failed to approve garage owner:", err);
  process.exit(1);
});

