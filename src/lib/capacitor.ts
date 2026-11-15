import { Capacitor } from "@capacitor/core";

export function isCapacitorNative(): boolean {
  try {
    return typeof window !== "undefined" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getCapacitorPlatform(): "android" | "ios" | "web" {
  try {
    const p = Capacitor.getPlatform();
    if (p === "android" || p === "ios") return p;
    return "web";
  } catch {
    return "web";
  }
}

