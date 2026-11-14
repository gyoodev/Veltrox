"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Bell, CheckCheck, ExternalLink, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { WebPushToggle } from "@/components/shared/web-push-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFirebaseClient } from "@/lib/firebase/client";
import { cn, formatDateShort } from "@/lib/utils";
import type { AppLocale, AppNotification } from "@/types/domain";

const NOTIFICATION_EVENT = "veltrox:notifications-refresh";
const NOTIFICATION_CHANNEL = "veltrox-notifications";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [hasNewPulse, setHasNewPulse] = useState(false);

  const initializedRef = useRef(false);
  const ownerReadyRef = useRef(false);
  const garageReadyRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const ownerMapRef = useRef<Map<string, AppNotification>>(new Map());
  const garageMapRef = useRef<Map<string, AppNotification>>(new Map());
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLiveArrivalToast = useCallback(
    (item: AppNotification) => {
      const actionConfig =
        item.actionUrl && item.actionUrl.startsWith("/")
          ? {
              label: t("openAction"),
              onClick: () => router.push(item.actionUrl as string),
            }
          : undefined;

      const options = {
        description: item.body,
        duration: item.priority === "critical" ? 9000 : 5500,
        ...(actionConfig ? { action: actionConfig } : {}),
      };

      if (item.priority === "critical") {
        toast.error(item.subject, options);
      } else if (item.priority === "important") {
        toast.warning(item.subject, options);
      } else {
        toast.info(item.subject, options);
      }
    },
    [router, t]
  );

  const applyNotifications = useCallback(
    (rawItems: AppNotification[], allowArrivalEffects: boolean) => {
      const deduped = new Map<string, AppNotification>();
      for (const item of rawItems) {
        if (item.channel === "in_app") {
          deduped.set(item.id, item);
        }
      }

      const sorted = Array.from(deduped.values())
        .sort((a, b) =>
          String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
        )
        .slice(0, 30);

      if (!initializedRef.current) {
        for (const item of sorted) {
          seenIdsRef.current.add(item.id);
        }
        initializedRef.current = true;
      } else {
        const freshUnread: AppNotification[] = [];
        for (const item of sorted) {
          if (!seenIdsRef.current.has(item.id)) {
            seenIdsRef.current.add(item.id);
            if (item.status !== "read" && !item.readAt) {
              freshUnread.push(item);
            }
          }
        }

        if (allowArrivalEffects && freshUnread.length > 0) {
          setHasNewPulse(true);
          if (pulseTimerRef.current) {
            clearTimeout(pulseTimerRef.current);
          }
          pulseTimerRef.current = setTimeout(() => {
            setHasNewPulse(false);
          }, 6500);

          const newest = freshUnread[0];
          if (newest) {
            showLiveArrivalToast(newest);
          }
        }
      }

      const nextUnread = sorted.filter(
        (n) => n.status !== "read" && !n.readAt
      ).length;

      setNotifications(sorted);
      setUnreadCount(nextUnread);
    },
    [showLiveArrivalToast]
  );

  const loadNotifications = useCallback(
    async (allowArrivalEffects = true) => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          notifications?: AppNotification[];
        };
        const items = data.notifications ?? [];
        applyNotifications(items, allowArrivalEffects);
      } catch {
        // Ignore transient network errors in background notification polling
      }
    },
    [applyNotifications]
  );

  // Initial server fetch so cookies work even before Firebase Client Auth finishes hydrating
  useEffect(() => {
    void loadNotifications(false);
  }, [loadNotifications]);

  // Layer 1: Firestore real-time onSnapshot listeners when client auth is ready
  useEffect(() => {
    const client = getFirebaseClient();
    const uid = firebaseUser?.uid;
    if (!client || !uid) {
      setIsLive(false);
      return;
    }

    const expectGarageListener = Boolean(
      profile?.role === "GARAGE_OWNER" &&
        profile.garageStatus === "approved" &&
        profile.garageId
    );
    ownerReadyRef.current = false;
    garageReadyRef.current = !expectGarageListener;

    const ownerMap = new Map<string, AppNotification>();
    const garageMap = new Map<string, AppNotification>();
    ownerMapRef.current = ownerMap;
    garageMapRef.current = garageMap;

    const flushCombined = (isSubsequentEvent: boolean) => {
      const merged = [
        ...Array.from(ownerMap.values()),
        ...Array.from(garageMap.values()),
      ];
      const bothReady = ownerReadyRef.current && garageReadyRef.current;
      applyNotifications(merged, isSubsequentEvent && bothReady);
    };

    const unsubscribers: Array<() => void> = [];

    const ownerQuery = query(
      collection(client.db, "notifications"),
      where("ownerId", "==", uid)
    );

    const unsubOwner = onSnapshot(
      ownerQuery,
      (snap) => {
        setIsLive(true);
        const wasReady = ownerReadyRef.current;
        ownerMap.clear();
        for (const d of snap.docs) {
          const item = { ...(d.data() as AppNotification), id: d.id };
          if (item.channel === "in_app") {
            ownerMap.set(item.id, item);
          }
        }
        ownerReadyRef.current = true;
        flushCombined(wasReady && initializedRef.current);
      },
      () => {
        setIsLive(false);
      }
    );
    unsubscribers.push(unsubOwner);

    if (expectGarageListener && profile?.garageId) {
      const garageQuery = query(
        collection(client.db, "notifications"),
        where("garageId", "==", profile.garageId)
      );
      const unsubGarage = onSnapshot(
        garageQuery,
        (snap) => {
          setIsLive(true);
          const wasReady = garageReadyRef.current;
          garageMap.clear();
          for (const d of snap.docs) {
            const item = { ...(d.data() as AppNotification), id: d.id };
            if (item.channel === "in_app") {
              garageMap.set(item.id, item);
            }
          }
          garageReadyRef.current = true;
          flushCombined(wasReady && initializedRef.current);
        },
        () => {
          garageReadyRef.current = true;
        }
      );
      unsubscribers.push(unsubGarage);
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [
    applyNotifications,
    firebaseUser?.uid,
    profile?.garageId,
    profile?.garageStatus,
    profile?.role,
  ]);

  // Layer 2 & 3: Cross-tab BroadcastChannel + in-app event + focus/visibility + adaptive polling fallback
  useEffect(() => {
    const onRefreshSignal = () => {
      void loadNotifications(true);
    };

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications(true);
      }
    };

    window.addEventListener(NOTIFICATION_EVENT, onRefreshSignal);
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(NOTIFICATION_CHANNEL);
        channel.onmessage = () => {
          void loadNotifications(true);
        };
      }
    } catch {
      channel = null;
    }

    // Fast polling fallback (7s) when Firestore listener isn't active; light safety poll (25s) otherwise
    const pollMs = isLive ? 25_000 : 7_000;
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadNotifications(true);
      }
    }, pollMs);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener(NOTIFICATION_EVENT, onRefreshSignal);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      if (channel) {
        channel.close();
      }
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, [isLive, loadNotifications]);

  const handleMarkAllRead = async () => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        status: "read",
        readAt: n.readAt ?? nowIso,
      }))
    );
    for (const [id, item] of ownerMapRef.current.entries()) {
      ownerMapRef.current.set(id, {
        ...item,
        status: "read",
        readAt: item.readAt ?? nowIso,
      });
    }
    for (const [id, item] of garageMapRef.current.entries()) {
      garageMapRef.current.set(id, {
        ...item,
        status: "read",
        readAt: item.readAt ?? nowIso,
      });
    }
    setUnreadCount(0);
    setHasNewPulse(false);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => null);
  };

  const handleSelectItem = async (item: AppNotification) => {
    if (!item.readAt && item.status !== "read") {
      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, status: "read", readAt: nowIso } : n
        )
      );
      const owned = ownerMapRef.current.get(item.id);
      if (owned) {
        ownerMapRef.current.set(item.id, {
          ...owned,
          status: "read",
          readAt: nowIso,
        });
      }
      const garaged = garageMapRef.current.get(item.id);
      if (garaged) {
        garageMapRef.current.set(item.id, {
          ...garaged,
          status: "read",
          readAt: nowIso,
        });
      }
      setUnreadCount((c) => Math.max(0, c - 1));
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      }).catch(() => null);
    }

    setOpen(false);
    if (item.actionUrl && item.actionUrl.startsWith("/")) {
      router.push(item.actionUrl);
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setHasNewPulse(false);
          void loadNotifications(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("bellAria", { count: unreadCount })}
          className="relative"
        >
          <Bell
            className={cn(
              "h-4 w-4 transition-transform",
              hasNewPulse && "animate-bounce text-primary"
            )}
            aria-hidden="true"
          />
          {hasNewPulse ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary animate-ping"
            />
          ) : null}
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-2">
            <DropdownMenuLabel className="p-0 text-sm font-semibold normal-case text-foreground">
              {t("title")}
            </DropdownMenuLabel>
            {isLive ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400"
                title={t("liveBadge")}
              >
                <Radio className="h-2.5 w-2.5 animate-pulse" aria-hidden="true" />
                {t("liveBadge")}
              </span>
            ) : null}
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("markAllRead")}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto p-1">
            {notifications.map((item) => {
              const isUnread = item.status !== "read" && !item.readAt;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleSelectItem(item)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isUnread ? "bg-primary/[0.08]" : "opacity-80",
                    item.priority === "critical" &&
                      isUnread &&
                      "border-l-2 border-red-500 bg-red-500/[0.08]",
                    item.priority === "important" &&
                      isUnread &&
                      "border-l-2 border-amber-500 bg-amber-500/[0.08]"
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="line-clamp-1 text-xs font-semibold text-foreground">
                        {item.subject}
                      </span>
                      {item.priority === "critical" ? (
                        <Badge
                          variant="destructive"
                          className="h-4 px-1 text-[9px] shrink-0"
                        >
                          {t("priorityCritical")}
                        </Badge>
                      ) : item.priority === "important" ? (
                        <Badge
                          variant="warning"
                          className="h-4 px-1 text-[9px] shrink-0"
                        >
                          {t("priorityImportant")}
                        </Badge>
                      ) : null}
                    </div>
                    {isUnread ? (
                      <span
                        aria-hidden="true"
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                  <div className="mt-0.5 flex w-full items-center justify-between text-[11px] text-muted-foreground/80">
                    <span className="font-mono">
                      {formatDateShort(item.createdAt, locale)}
                    </span>
                    {item.actionUrl ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        {t("openAction")}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <WebPushToggle variant="compact" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
