"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldAlert,
  Trash2,
  UserSquare2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type StaffInviteValues,
  staffInviteSchema,
} from "@/lib/validators/garage";
import {
  type GarageStaff,
  STAFF_ROLES,
  type StaffRole,
} from "@/types/domain";

interface StaffManagementClientProps {
  initialStaff: GarageStaff[];
}

export function StaffManagementClient({
  initialStaff,
}: StaffManagementClientProps) {
  const t = useTranslations("garageWorkspace.staff");
  const tShell = useTranslations("shell");
  const tVal = useTranslations("validation");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [staff, setStaff] = useState<GarageStaff[]>(initialStaff);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<StaffInviteValues>({
    resolver: zodResolver(staffInviteSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      staffRole: "mechanic",
    },
  });

  const translateErr = (key?: string) => {
    if (!key) return null;
    try {
      return tVal(key as never);
    } catch {
      return key;
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await fetch("/api/garage/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (res.status === 409) {
      toast.error(t("emailExistsError"));
      return;
    }

    if (!res.ok) {
      toast.error("Failed to create staff account.");
      return;
    }

    const json = (await res.json()) as { staffMember: GarageStaff };
    setStaff((prev) => [json.staffMember, ...prev]);
    toast.success(t("savedToast"));
    setDialogOpen(false);
    form.reset();
    router.refresh();
  });

  const handleToggleActive = async (member: GarageStaff) => {
    const nextActive = !member.active;
    const prev = staff;
    setStaff((list) =>
      list.map((m) => (m.id === member.id ? { ...m, active: nextActive } : m))
    );

    const res = await fetch(`/api/garage/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });

    if (!res.ok) {
      setStaff(prev);
      toast.error("Update failed.");
      return;
    }
    router.refresh();
  };

  const handleDelete = async (staffDocId: string) => {
    const prev = staff;
    setStaff((list) => list.filter((m) => m.id !== staffDocId));

    const res = await fetch(`/api/garage/staff/${staffDocId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setStaff(prev);
      toast.error("Remove failed.");
      return;
    }

    toast.success(t("deletedToast"));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        <Button
          type="button"
          variant="gradient"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("addStaffBtn")}
        </Button>
      </div>

      {/* Limited-Permission Security Notice */}
      <Card className="flex items-start gap-3 border-primary/25 bg-primary/5 p-4 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="leading-relaxed">{t("permissionsNote")}</p>
      </Card>

      {staff.length === 0 ? (
        <EmptyState
          icon={UserSquare2}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Button
              type="button"
              variant="gradient"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("addStaffBtn")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {staff.map((member) => (
            <Card
              key={member.id}
              className="flex items-center justify-between gap-4 p-5"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {member.displayName}
                  </h2>
                  <Badge variant="violet">
                    {member.staffRole === "receptionist"
                      ? tShell("staffRoleReceptionist")
                      : tShell("staffRoleMechanic")}
                  </Badge>
                  <Badge variant={member.active ? "success" : "warning"}>
                    {member.active ? t("statusActive") : t("statusSuspended")}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {member.email}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleToggleActive(member)}
                >
                  {member.active ? (
                    <>
                      <PauseCircle className="h-3.5 w-3.5" />
                      {t("pauseAccess")}
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                      {t("restoreAccess")}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  aria-label={t("removeStaff")}
                  onClick={() => void handleDelete(member.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Staff Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addStaffBtn")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">{t("displayName")}</Label>
              <Input id="st-name" {...form.register("displayName")} />
              {form.formState.errors.displayName ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.displayName.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-email">{t("email")}</Label>
              <Input
                id="st-email"
                type="email"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.email.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-pass">{t("initialPassword")}</Label>
              <Input
                id="st-pass"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">
                  {translateErr(form.formState.errors.password.message)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>{t("roleLabel")}</Label>
              <Controller
                control={form.control}
                name="staffRole"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as StaffRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r === "receptionist"
                            ? tShell("staffRoleReceptionist")
                            : tShell("staffRoleMechanic")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                variant="gradient"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

