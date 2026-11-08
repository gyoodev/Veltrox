"use client";

import { Building2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateShort } from "@/lib/utils";
import type {
  AppLocale,
  Garage,
  GarageApprovalStatus,
  UserProfile,
} from "@/types/domain";

export interface GarageApplicantRow {
  user: UserProfile;
  garage: Garage | null;
}

interface ApprovalsQueueClientProps {
  initialRows: GarageApplicantRow[];
}

export function ApprovalsQueueClient({
  initialRows,
}: ApprovalsQueueClientProps) {
  const t = useTranslations("adminPanel.approvals");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;

  const [rows, setRows] = useState<GarageApplicantRow[]>(initialRows);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending"
  );
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<GarageApplicantRow | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState<string>("");

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.user.garageStatus === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of rows) {
      if (r.user.garageStatus === "pending") pending += 1;
      else if (r.user.garageStatus === "approved") approved += 1;
      else if (r.user.garageStatus === "rejected") rejected += 1;
    }
    return { pending, approved, rejected };
  }, [rows]);

  const submitDecision = async (
    uid: string,
    decision: "approved" | "rejected",
    reason?: string
  ) => {
    setBusyUid(uid);
    try {
      const res = await fetch(`/api/admin/garages/${uid}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });

      if (!res.ok) {
        toast.error(t("errorToast"));
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.user.uid === uid
            ? {
                ...row,
                user: {
                  ...row.user,
                  garageStatus: decision as GarageApprovalStatus,
                  garageRejectionReason:
                    decision === "rejected" ? (reason ?? null) : null,
                },
                garage: row.garage
                  ? { ...row.garage, status: decision }
                  : null,
              }
            : row
        )
      );

      toast.success(
        decision === "approved" ? t("approvedToast") : t("rejectedToast")
      );
      setRejectTarget(null);
      setRejectReason("");
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setBusyUid(null);
    }
  };

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

      <Tabs
        value={filter}
        onValueChange={(v) =>
          setFilter(v as "pending" | "approved" | "rejected" | "all")
        }
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">
            {tCommon("statusPending")} ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">
            {tCommon("statusApproved")} ({counts.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            {tCommon("statusRejected")} ({counts.rejected})
          </TabsTrigger>
          <TabsTrigger value="all">
            {t("tabAll")} ({rows.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="space-y-4">
          {filteredRows.map((item) => {
            const { user, garage } = item;
            const isBusy = busyUid === user.uid;

            return (
              <Card key={user.uid} className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">
                        {garage?.name || user.displayName}
                      </h2>
                      <Badge
                        variant={
                          user.garageStatus === "approved"
                            ? "success"
                            : user.garageStatus === "rejected"
                              ? "warning"
                              : "default"
                        }
                      >
                        {user.garageStatus === "approved" ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : user.garageStatus === "rejected" ? (
                          <XCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <Clock className="mr-1 h-3 w-3" />
                        )}
                        {user.garageStatus === "approved"
                          ? tCommon("statusApproved")
                          : user.garageStatus === "rejected"
                            ? tCommon("statusRejected")
                            : tCommon("statusPending")}
                      </Badge>
                      {garage ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {garage.city}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="font-mono text-xs text-muted-foreground">
                      {user.email}
                      {user.phone ? ` • ${user.phone}` : ""}
                      {` • ${formatDateShort(user.createdAt, locale)}`}
                    </p>

                    {garage ? (
                      <p className="text-xs text-muted-foreground">
                        {garage.address} • {garage.servicesOffered.slice(0, 4).join(", ")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("awaitingOnboardingNote")}
                      </p>
                    )}

                    {user.garageStatus === "rejected" &&
                    user.garageRejectionReason ? (
                      <p className="mt-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-300">
                        <strong>{t("rejectionReasonLabel")}:</strong>{" "}
                        {user.garageRejectionReason}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                    {user.garageStatus !== "approved" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="gradient"
                        disabled={isBusy}
                        onClick={() => void submitDecision(user.uid, "approved")}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        {t("approveBtn")}
                      </Button>
                    ) : null}

                    {user.garageStatus !== "rejected" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectTarget(item);
                          setRejectReason(user.garageRejectionReason ?? "");
                        }}
                      >
                        <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                        {t("rejectBtn")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectModalTitle")}</DialogTitle>
            <DialogDescription>{t("rejectModalDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reject-reason-input">{t("reasonInputLabel")}</Label>
              <Input
                id="reject-reason-input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRejectTarget(null)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  rejectReason.trim().length < 3 ||
                  busyUid === rejectTarget?.user.uid
                }
                onClick={() => {
                  if (rejectTarget) {
                    void submitDecision(
                      rejectTarget.user.uid,
                      "rejected",
                      rejectReason.trim()
                    );
                  }
                }}
              >
                {t("confirmRejectBtn")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

