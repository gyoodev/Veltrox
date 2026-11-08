"use client";

import { FileClock, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateShort } from "@/lib/utils";
import {
  AUDIT_LOG_ACTIONS,
  type AppLocale,
  type AuditLog,
  type AuditLogAction,
} from "@/types/domain";

interface AuditLogsClientProps {
  logs: AuditLog[];
}

export function AuditLogsClient({ logs }: AuditLogsClientProps) {
  const t = useTranslations("adminPanel.audit");
  const locale = useLocale() as AppLocale;

  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | AuditLogAction>(
    "ALL"
  );

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      if (!q) return true;
      const metaText = JSON.stringify(log.metadata ?? {}).toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.actorUid.toLowerCase().includes(q) ||
        (log.targetUid ?? "").toLowerCase().includes(q) ||
        (log.targetGarageId ?? "").toLowerCase().includes(q) ||
        metaText.includes(q)
      );
    });
  }, [logs, actionFilter, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("pageSubtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-10"
          />
        </div>

        <div className="w-full sm:w-72">
          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v as "ALL" | AuditLogAction)}
          >
            <SelectTrigger aria-label={t("allActions")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("allActions")}</SelectItem>
              {AUDIT_LOG_ACTIONS.map((act) => (
                <SelectItem key={act} value={act}>
                  {act}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={FileClock}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const entries = Object.entries(log.metadata ?? {}).filter(
              ([, v]) => v !== null && v !== undefined && v !== ""
            );

            return (
              <Card key={log.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        log.action.includes("REJECTED") ||
                        log.action.includes("SUSPENDED") ||
                        log.action.includes("DELETED")
                          ? "warning"
                          : log.action.includes("APPROVED") ||
                              log.action.includes("PROMOTED")
                            ? "success"
                            : "default"
                      }
                      className="font-mono text-[11px]"
                    >
                      {log.action}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {log.actorRole}
                    </Badge>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDateShort(log.createdAt, locale)}{" "}
                    {log.createdAt.slice(11, 19)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
                  <span>
                    {t("actorLabel")}:{" "}
                    <strong className="text-foreground">{log.actorUid}</strong>
                  </span>
                  {log.targetUid ? (
                    <span>
                      {t("targetUserLabel")}:{" "}
                      <strong className="text-foreground">
                        {log.targetUid}
                      </strong>
                    </span>
                  ) : null}
                  {log.targetGarageId ? (
                    <span>
                      {t("targetGarageLabel")}:{" "}
                      <strong className="text-foreground">
                        {log.targetGarageId}
                      </strong>
                    </span>
                  ) : null}
                </div>

                {entries.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {entries.map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                      >
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

