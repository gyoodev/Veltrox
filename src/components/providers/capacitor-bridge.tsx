"use client";

import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect } from "react";
import { getCapacitorPlatform, isCapacitorNative } from "@/lib/capacitor";

const ROOT_EXIT_PATHS = new Set(["/", "/app", "/garage", "/admin", "/login"]);

/**
 * Coordinates native mobile shell behavior when running inside Veltrox's
 * Capacitor Android/iOS wrapper. No-op on standard desktop/mobile browsers.
 */
export function CapacitorBridge() {
  useEffect(() => {
    if (!isCapacitorNative()) return;

    const platform = getCapacitorPlatform();

    void (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (platform === "android") {
          await StatusBar.setBackgroundColor({ color: "#090d16" });
        }
      } catch {
        // Ignore status bar customization errors on older OS versions
      }

      try {
        await SplashScreen.hide();
      } catch {
        // Splash screen already hidden
      }
    })();

    const backSub = App.addListener("backButton", ({ canGoBack }) => {
      const path = window.location.pathname;
      if (canGoBack && !ROOT_EXIT_PATHS.has(path) && window.history.length > 1) {
        window.history.back();
        return;
      }
      void App.exitApp();
    });

    const urlSub = App.addListener("appUrlOpen", (event) => {
      if (!event?.url) return;
      try {
        const parsed = new URL(event.url);
        if (parsed.protocol === "veltrox:") {
          const target = `/${parsed.host}${parsed.pathname}${parsed.search}`.replace(
            /\/+/g,
            "/"
          );
          window.location.assign(target);
          return;
        }
        if (parsed.pathname) {
          window.location.assign(`${parsed.pathname}${parsed.search}`);
        }
      } catch {
        // Ignore malformed deep-link URLs
      }
    });

    return () => {
      void backSub.then((h) => h.remove());
      void urlSub.then((h) => h.remove());
    };
  }, []);

  return null;
}

