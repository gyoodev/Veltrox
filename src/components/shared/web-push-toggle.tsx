"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getFirebaseClient } from "@/lib/firebase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function buildAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const fb = getFirebaseClient();
  if (fb?.auth.currentUser) {
    try {
      const token = await fb.auth.currentUser.getIdToken(false);
      headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  return headers;
}

interface WebPushToggleProps {
  variant?: "compact" | "card";
}

export function WebPushToggle({ variant = "compact" }: WebPushToggleProps) {
  const t = useTranslations("webPush");

  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadStatus = useCallback(async () => {
    const canPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(canPush);

    try {
      const headers = await buildAuthHeaders();
      const res = await fetch("/api/push/subscribe", { headers });
      if (res.ok) {
        const data = (await res.json()) as {
          configured: boolean;
          publicKey: string | null;
          subscribedCount: number;
          pushEnabled: boolean;
        };
        setConfigured(data.configured);
        setPublicKey(data.publicKey);

        if (canPush) {
          const reg = await navigator.serviceWorker.getRegistration("/sw.js");
          const existing = reg
            ? await reg.pushManager.getSubscription()
            : null;
          setSubscribed(Boolean(existing) && data.subscribedCount > 0);
        } else {
          setSubscribed(data.subscribedCount > 0);
        }
      }
    } catch {
      // Ignore silent status check errors
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleEnable = async () => {
    if (!supported) {
      toast.error(t("unsupportedToast"));
      return;
    }
    if (!configured || !publicKey) {
      toast.info(t("notConfiguredToast"));
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("permissionDeniedToast"));
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        toast.error(t("subscribeErrorToast"));
        return;
      }

      const headers = await buildAuthHeaders();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers,
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        }),
      });

      if (!res.ok) {
        toast.error(t("subscribeErrorToast"));
        return;
      }

      setSubscribed(true);
      toast.success(t("enabledToast"));
    } catch {
      toast.error(t("subscribeErrorToast"));
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      let endpoint: string | undefined;
      if (supported) {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = reg ? await reg.pushManager.getSubscription() : null;
        if (existing) {
          endpoint = existing.endpoint;
          await existing.unsubscribe().catch(() => {});
        }
      }

      const headers = await buildAuthHeaders();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ endpoint }),
      });

      setSubscribed(false);
      toast.success(t("disabledToast"));
    } catch {
      toast.error(t("subscribeErrorToast"));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {subscribed ? (
            <BellRing className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <BellOff className="h-3.5 w-3.5" />
          )}
          <span>{t("label")}</span>
        </div>
        <Button
          type="button"
          variant={subscribed ? "outline" : "secondary"}
          size="sm"
          className="h-7 px-2.5 text-[11px]"
          disabled={busy || !supported}
          onClick={() => void (subscribed ? handleDisable() : handleEnable())}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : subscribed ? (
            t("disableAction")
          ) : (
            t("enableAction")
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3.5 rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <BellRing className="h-4 w-4" />
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
            {!configured ? (
              <Badge variant="secondary" className="text-[10px]">
                {t("vapidPendingBadge")}
              </Badge>
            ) : subscribed ? (
              <Badge variant="success" className="text-[10px]">
                {t("activeBadge")}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>

      <Switch
        checked={subscribed}
        disabled={busy || !supported}
        onCheckedChange={(checked) =>
          void (checked ? handleEnable() : handleDisable())
        }
        aria-label={t("title")}
      />
    </div>
  );
}

