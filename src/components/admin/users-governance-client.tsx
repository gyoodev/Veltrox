"use client";

import { Ban, CheckCircle, Search, Shield, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { AppLocale, Garage, UserProfile, UserRole } from "@/types/domain";

interface UsersGovernanceClientProps {
  currentAdminUid: string;
  initialUsers: UserProfile[];
  garages: Garage[];
}

export function UsersGovernanceClient({
  currentAdminUid,
  initialUsers,
  garages: initialGarages,
}: UsersGovernanceClientProps) {
  const t = useTranslations("adminPanel.users");
  const locale = useLocale() as AppLocale;

  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [garages, setGarages] = useState<Garage[]>(initialGarages);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const garageById = useMemo(
    () => new Map(garages.map((g) => [g.id, g])),
    [garages]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      const gName = u.garageId ? (garageById.get(u.garageId)?.name ?? "") : "";
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q) ||
        gName.toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, search, garageById]);

  const patchUser = async (
    uid: string,
    payload: {
      suspended?: boolean;
      role?: UserRole;
      garagePlan?: "free" | "pro";
    }
  ) => {
    setBusyUid(uid);
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error(t("updateErrorToast"));
        return;
      }

      const data = (await res.json()) as {
        role: UserRole;
        garageStatus: UserProfile["garageStatus"];
        suspended: boolean;
        garagePlan?: "free" | "pro";
      };

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? {
                ...u,
                role: data.role,
                garageStatus: data.garageStatus,
                suspended: data.suspended,
              }
            : u
        )
      );

      if (payload.garagePlan) {
        const target = users.find((u) => u.uid === uid);
        if (target?.garageId) {
          setGarages((prev) =>
            prev.map((g) =>
              g.id === target.garageId
                ? {
                    ...g,
                    plan: payload.garagePlan ?? g.plan,
                    monthlyReminderQuota:
                      payload.garagePlan === "pro" ? 500 : 50,
                  }
                : g
            )
          );
        }
      }

      toast.success(t("updatedToast"));
    } catch {
      toast.error(t("updateErrorToast"));
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

      {/* Search & Role Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v as "ALL" | UserRole)}
          >
            <SelectTrigger aria-label={t("filterAllRoles")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("filterAllRoles")}</SelectItem>
              <SelectItem value="USER">USER</SelectItem>
              <SelectItem value="GARAGE_OWNER">GARAGE_OWNER</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isSelf = user.uid === currentAdminUid;
            const isBusy = busyUid === user.uid;
            const linkedGarage = user.garageId
              ? (garageById.get(user.garageId) ?? null)
              : null;

            return (
              <Card key={user.uid} className="p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {user.displayName}
                      </span>
                      <Badge
                        variant={
                          user.role === "ADMIN"
                            ? "violet"
                            : user.role === "GARAGE_OWNER"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {user.role === "ADMIN" ? (
                          <Shield className="mr-1 h-3 w-3" />
                        ) : null}
                        {user.role}
                        {user.isStaff ? " (Staff)" : ""}
                      </Badge>
                      {user.suspended ? (
                        <Badge variant="warning">{t("suspendedBadge")}</Badge>
                      ) : null}
                      {linkedGarage ? (
                        <Badge variant="outline">
                          {linkedGarage.name} •{" "}
                          {linkedGarage.plan.toUpperCase()}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {user.email}
                      {user.phone ? ` • ${user.phone}` : ""}
                      {` • ${formatDateShort(user.createdAt, locale)}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {linkedGarage && !user.isStaff ? (
                      <div className="w-36">
                        <Select
                          value={linkedGarage.plan}
                          disabled={isBusy}
                          onValueChange={(plan) =>
                            void patchUser(user.uid, {
                              garagePlan: plan as "free" | "pro",
                            })
                          }
                        >
                          <SelectTrigger aria-label={t("planLabel")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free (50/mo)</SelectItem>
                            <SelectItem value="pro">Pro (500/mo)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    <div className="w-40">
                      <Select
                        value={user.role}
                        disabled={isSelf || isBusy}
                        onValueChange={(nextRole) =>
                          void patchUser(user.uid, {
                            role: nextRole as UserRole,
                          })
                        }
                      >
                        <SelectTrigger aria-label={t("roleSelectAria")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">USER</SelectItem>
                          <SelectItem value="GARAGE_OWNER">
                            GARAGE_OWNER
                          </SelectItem>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant={user.suspended ? "outline" : "destructive"}
                      disabled={isSelf || isBusy}
                      onClick={() =>
                        void patchUser(user.uid, { suspended: !user.suspended })
                      }
                    >
                      {user.suspended ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("unsuspendBtn")}
                        </>
                      ) : (
                        <>
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("suspendBtn")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

