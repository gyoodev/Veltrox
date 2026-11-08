/**
 * Veltrox — Firebase Full Setup & Live Connectivity Doctor
 *
 * Usage:
 *   npm run firebase:doctor
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function loadEnvFile(filePath) {
  const map = {};
  if (!existsSync(filePath)) return map;
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

async function runDoctor() {
  console.log("\n=== Veltrox Firebase Setup Doctor ===\n");
  const cwd = process.cwd();
  const env = loadEnvFile(resolve(cwd, ".env.local"));

  // 1. Project alias
  const firebasercPath = resolve(cwd, ".firebaserc");
  const defaultProject = existsSync(firebasercPath)
    ? JSON.parse(readFileSync(firebasercPath, "utf8"))?.projects?.default
    : null;
  console.log(
    defaultProject
      ? `[OK] .firebaserc project: ${defaultProject}`
      : "[WARN] .firebaserc missing default project"
  );

  // 2. Client Web SDK
  const clientKeys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missingClient = clientKeys.filter((k) => !env[k]);
  if (missingClient.length === 0) {
    console.log(
      `[OK] Firebase Client SDK (.env.local): ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`
    );
  } else {
    console.log(
      `[FAIL] Missing Firebase Client keys in .env.local: ${missingClient.join(", ")}`
    );
  }

  // 3. Session & Cron secrets
  console.log(
    env.SESSION_SECRET && env.SESSION_SECRET.length >= 32
      ? "[OK] SESSION_SECRET (>= 32 chars)"
      : "[FAIL] SESSION_SECRET missing or shorter than 32 chars"
  );
  console.log(
    env.CRON_SECRET && env.CRON_SECRET.length >= 16
      ? "[OK] CRON_SECRET (>= 16 chars)"
      : "[WARN] CRON_SECRET missing"
  );

  // 4. Rules, Indexes & Cloud Functions v2 build
  for (const rel of [
    "firebase.json",
    "firestore.rules",
    "firestore.indexes.json",
    "storage.rules",
    "functions/lib/index.js",
  ]) {
    console.log(
      existsSync(resolve(cwd, rel))
        ? `[OK] ${rel} present`
        : `[WARN] ${rel} missing (run npm run functions:build)`
    );
  }

  // 5. Admin SDK credentials + live connectivity test
  let projectId = env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  let clientEmail = env.FIREBASE_CLIENT_EMAIL;
  let privateKey = env.FIREBASE_PRIVATE_KEY
    ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "";

  if (!clientEmail || !privateKey || privateKey.includes("YOUR_PRIVATE_KEY_HERE")) {
    const candidate = readdirSync(cwd).find(
      (name) =>
        name === "serviceAccountKey.json" ||
        (name.includes("firebase-adminsdk") && name.endsWith(".json"))
    );
    if (candidate) {
      const parsed = JSON.parse(readFileSync(resolve(cwd, candidate), "utf8"));
      projectId = parsed.project_id;
      clientEmail = parsed.client_email;
      privateKey = parsed.private_key;
      console.log(`[OK] Auto-detected Service Account JSON: ${candidate}`);
    }
  }

  if (!clientEmail || !privateKey || privateKey.includes("YOUR_PRIVATE_KEY_HERE")) {
    console.log(
      "\n[ACTION NEEDED] Firebase Admin SDK Service Account ключ все още не е добавен!"
    );
    console.log(
      "  За да работят ВСИЧКИ сървърни функции (Вход, Регистрация, Дневник, Работни поръчки, Админ панел):"
    );
    console.log(
      `  1. Отворете: https://console.firebase.google.com/project/${defaultProject || "veltrox-gkdev"}/settings/serviceaccounts/adminsdk`
    );
    console.log('  2. Натиснете "Generate new private key" -> изтеглете JSON файла.');
    console.log(
      '  3. Поставете файла като "serviceAccountKey.json" в папката на проекта ИЛИ изпълнете:'
    );
    console.log('     npm run import-admin-key -- "C:\\път\\до\\изтегления-файл.json"\n');
    process.exit(0);
  }

  try {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    await getAuth(app).listUsers(1);
    console.log(`[OK] Live Firebase Auth Admin connection verified (${projectId})`);
    await getFirestore(app).collection("platformConfig").doc("public").get();
    console.log(`[OK] Live Cloud Firestore Admin connection verified (${projectId})`);
    console.log("\nВСИЧКИ Firebase услуги са свързани и готови за работа!\n");
  } catch (err) {
    console.error("\n[FAIL] Грешка при връзка с Firebase Admin SDK:", err.message || err);
    process.exit(1);
  }
}

runDoctor();

