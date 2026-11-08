/**
 * CLI Utility: Assign the ADMIN role to an existing Veltrox user.
 *
 * Security invariant: ADMIN can NEVER be selected during registration.
 * Use this script to bootstrap the initial platform administrator:
 *
 *   npm run set-admin -- admin@example.com
 *   # or by Firebase UID:
 *   npm run set-admin -- <uid>
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
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

  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    const candidate = readdirSync(process.cwd()).find(
      (name) =>
        name === "serviceAccountKey.json" ||
        (name.includes("firebase-adminsdk") && name.endsWith(".json"))
    );
    if (candidate) {
      const parsed = JSON.parse(
        readFileSync(resolve(process.cwd(), candidate), "utf8")
      ) as { project_id?: string; client_email?: string; private_key?: string };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        process.env.FIREBASE_PROJECT_ID ||= parsed.project_id;
        process.env.FIREBASE_CLIENT_EMAIL = parsed.client_email;
        process.env.FIREBASE_PRIVATE_KEY = parsed.private_key;
      }
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const target = process.argv[2]?.trim();
  if (!target) {
    console.error("Usage: npm run set-admin -- <email-or-uid>");
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
    role: "ADMIN",
    garageStatus: "none",
  });

  const nowIso = new Date().toISOString();
  await db
    .collection("users")
    .doc(userRecord.uid)
    .set(
      {
        uid: userRecord.uid,
        email: userRecord.email ?? "",
        displayName: userRecord.displayName ?? "Platform Admin",
        role: "ADMIN",
        garageStatus: "none",
        suspended: false,
        updatedAt: nowIso,
      },
      { merge: true }
    );

  await db.collection("auditLogs").add({
    action: "USER_ROLE_PROMOTED_TO_ADMIN",
    actorUid: "cli-bootstrap",
    actorRole: "ADMIN",
    targetUid: userRecord.uid,
    metadata: {
      method: "scripts/set-admin.ts",
    },
    createdAt: nowIso,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  console.log(
    `Success: ${userRecord.email ?? userRecord.uid} (${userRecord.uid}) is now ADMIN.`
  );
  console.log("Ask the user to sign out and sign back in to refresh their session.");
}

main().catch((err: unknown) => {
  console.error("Failed to assign ADMIN role:", err);
  process.exit(1);
});

