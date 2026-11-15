import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const mode = (process.argv[2] || "debug").toLowerCase();
const rootDir = process.cwd();
const androidDir = path.join(rootDir, "android");
const isWin = process.platform === "win32";

function pickExistingDir(candidates) {
  for (const dir of candidates) {
    if (dir && fs.existsSync(dir)) return dir;
  }
  return null;
}

const javaHome =
  process.env.JAVA_HOME ||
  pickExistingDir([
    "D:\\Android\\jdk-21",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21",
    "C:\\Program Files\\Microsoft\\jdk-21",
    "C:\\Program Files\\Android\\Android Studio\\jbr",
  ]);

const androidSdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  pickExistingDir([
    "D:\\Android\\Sdk",
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
    path.join(process.env.HOME || "", "Library", "Android", "sdk"),
    path.join(process.env.HOME || "", "Android", "Sdk"),
  ]);

const env = { ...process.env };
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${env.PATH || ""}`;
}
if (androidSdk) {
  env.ANDROID_HOME = androidSdk;
  env.ANDROID_SDK_ROOT = androidSdk;
}

console.log("[Veltrox Mobile] Mode:", mode);
console.log("[Veltrox Mobile] JAVA_HOME:", env.JAVA_HOME || "(system default)");
console.log("[Veltrox Mobile] ANDROID_HOME:", env.ANDROID_HOME || "(system default)");

// Sync Capacitor Android assets & config first
const capBin = path.join(rootDir, "node_modules", ".bin", isWin ? "cap.cmd" : "cap");
const syncRes = spawnSync(capBin, ["sync", "android"], {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: isWin,
});
if (syncRes.status !== 0) {
  process.exit(syncRes.status ?? 1);
}

const gradleCmd = isWin ? path.join(androidDir, "gradlew.bat") : "./gradlew";
const tasks =
  mode === "release"
    ? ["assembleRelease", "bundleRelease"]
    : mode === "all"
      ? ["assembleDebug", "assembleRelease", "bundleRelease"]
      : ["assembleDebug"];

const gradleRes = spawnSync(gradleCmd, tasks, {
  cwd: androidDir,
  env,
  stdio: "inherit",
  shell: isWin,
});
process.exit(gradleRes.status ?? 1);

