"use client";

import { Cookie, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { syncFirebaseAnalyticsConsent } from "@/lib/firebase/client";

const CONSENT_STORAGE_KEY = "veltrox_cookie_consent_v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "veltrox:open-cookie-settings";

interface CookieConsentState {
  essential: true;
  analytics: boolean;
  updatedAt: string;
}

export function CookieConsent() {
  const t = useTranslations("cookies");
  const tFooter = useTranslations("footer");
  const [showBanner, setShowBanner] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!stored) {
        setShowBanner(true);
      } else {
        const parsed = JSON.parse(stored) as Partial<CookieConsentState>;
        const allowed = Boolean(parsed.analytics);
        setAnalyticsEnabled(allowed);
        void syncFirebaseAnalyticsConsent(allowed);
      }
    } catch {
      setShowBanner(true);
    }

    const handleOpen = () => setModalOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpen);
    return () =>
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpen);
  }, []);

  const persistConsent = (analytics: boolean) => {
    const payload: CookieConsentState = {
      essential: true,
      analytics,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors in private mode
    }
    setAnalyticsEnabled(analytics);
    void syncFirebaseAnalyticsConsent(analytics);
    setShowBanner(false);
    setModalOpen(false);
  };

  return (
    <>
      {showBanner ? (
        <aside
          aria-label={t("title")}
          className="fixed inset-x-0 bottom-0 z-40 p-4 sm:p-6"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-border bg-popover/95 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Cookie className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("title")}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("description")}{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {tFooter("privacy")}
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                {t("customize")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => persistConsent(false)}
              >
                {t("essentialOnly")}
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => persistConsent(true)}
              >
                {t("acceptAll")}
              </Button>
            </div>
          </div>
        </aside>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t("modalTitle")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t("essentialTitle")}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("essentialDesc")}
                </p>
              </div>
              <Switch checked disabled aria-label={t("essentialTitle")} />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/20 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t("analyticsTitle")}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("analyticsDesc")}
                </p>
              </div>
              <Switch
                checked={analyticsEnabled}
                onCheckedChange={setAnalyticsEnabled}
                aria-label={t("analyticsTitle")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => persistConsent(false)}
            >
              {t("essentialOnly")}
            </Button>
            <Button
              variant="gradient"
              onClick={() => persistConsent(analyticsEnabled)}
            >
              {t("savePreferences")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

