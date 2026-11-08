"use client";

import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatDateShort } from "@/lib/utils";
import type { AppLocale, AppNotification } from "@/types/domain";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: AppNotification[];
        unreadCount?: number;
      };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Ignore transient network errors in header polling
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        status: "read",
        readAt: n.readAt ?? new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => null);
  };

  const handleSelectItem = async (item: AppNotification) => {
    if (!item.readAt && item.status !== "read") {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, status: "read", readAt: new Date().toISOString() }
            : n
        )
      );
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
          void loadNotifications();
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
          <Bell className="h-4 w-4" aria-hidden="true" />
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
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold normal-case text-foreground">
            {t("title")}
          </DropdownMenuLabel>
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
                    isUnread ? "bg-primary/[0.08]" : "opacity-80"
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="line-clamp-1 text-xs font-semibold text-foreground">
                      {item.subject}
                    </span>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

