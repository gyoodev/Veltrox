/**
 * Local Helper: Safely imports a downloaded Firebase Service Account JSON file
 * into `.env.local` (which is Git-ignored) with proper newline escaping.
 *
 * Usage:
 *   # Option A: Drop `serviceAccountKey.json` (or `*-firebase-adminsdk-*.json`) into project root and run:
 *   npm run import-admin-key
 *
 *   # Option B: Pass explicit file path:
 *   npm run import-admin-key -- "C:\Users\You\Downloads\veltrox-gkdev-firebase-adminsdk-xxxx.json"
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function findDefaultJsonInRoot() {
  const cwd = process.cwd();
  const files = readdirSync(cwd);
  const candidate = files.find(
    (name) =>
      name === "serviceAccountKey.json" ||
      (name.includes("firebase-adminsdk") && name.endsWith(".json"))
  );
  return candidate ? resolve(cwd, candidate) : null;
}

const jsonArg = process.argv[2]?.trim();
const jsonPath = jsonArg ? resolve(process.cwd(), jsonArg) : findDefaultJsonInRoot();

if (!jsonPath || !existsSync(jsonPath)) {
  console.error(
    'Не е намерен Service Account JSON файл.\nПоставете файла като "serviceAccountKey.json" в главната папка на проекта или изпълнете:\n  npm run import-admin-key -- "<път-до-firebase-adminsdk.json>"'
  );
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
  console.error(
    "Invalid Firebase Service Account JSON (missing project_id, client_email, or private_key)."
  );
  process.exit(1);
}

const envLocalPath = resolve(process.cwd(), ".env.local");
let envContent = existsSync(envLocalPath)
  ? readFileSync(envLocalPath, "utf8")
  : readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

function upsertEnvVar(source, key, value) {
  const escapedLine = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(source)) {
    return source.replace(regex, () => escapedLine);
  }
  return `${source.trimEnd()}\n${escapedLine}\n`;
}

const escapedPrivateKey = `"${String(parsed.private_key).replace(/\r?\n/g, "\\n")}"`;

envContent = upsertEnvVar(envContent, "FIREBASE_PROJECT_ID", parsed.project_id);
envContent = upsertEnvVar(
  envContent,
  "FIREBASE_CLIENT_EMAIL",
  parsed.client_email
);
envContent = upsertEnvVar(
  envContent,
  "FIREBASE_PRIVATE_KEY",
  escapedPrivateKey
);

writeFileSync(envLocalPath, envContent, "utf8");
console.log(
  `Успешно импортиран Firebase Admin ключ в .env.local за ${parsed.client_email} (${parsed.project_id}).`
);
