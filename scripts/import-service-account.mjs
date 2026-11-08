/**
 * Local Helper: Safely imports a downloaded Firebase Service Account JSON file
 * into `.env.local` (which is Git-ignored) with proper newline escaping.
 *
 * Usage:
 *   npm run import-admin-key -- "C:\Users\You\Downloads\veltrox-gkdev-firebase-adminsdk-xxxx.json"
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const jsonArg = process.argv[2];
if (!jsonArg) {
  console.error(
    'Usage: npm run import-admin-key -- "<path-to-firebase-adminsdk.json>"'
  );
  process.exit(1);
}

const jsonPath = resolve(process.cwd(), jsonArg);
if (!existsSync(jsonPath)) {
  console.error(`File not found: ${jsonPath}`);
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
  `Updated .env.local with Admin SDK credentials for ${parsed.client_email} (${parsed.project_id}).`
);

