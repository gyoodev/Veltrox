"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { CapacitorBridge } from "@/components/providers/capacitor-bridge";
import type { UserProfile } from "@/types/domain";

export function AppProviders({
  children,
  initialProfile = null,
}: {
  children: ReactNode;
  initialProfile?: UserProfile | null;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <MotionConfig reducedMotion="user">
        <AuthProvider initialProfile={initialProfile}>
          <CapacitorBridge />
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              className:
                "rounded-xl border border-border bg-card text-card-foreground shadow-lg",
            }}
          />
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

