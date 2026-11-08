"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
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

