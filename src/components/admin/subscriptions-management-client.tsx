"use client";

import {
  Building2,
  Coins,
  CreditCard,
  Crown,
  Loader2,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { formatDateShort } from "@/lib/utils";
import type {
  AppLocale,
  Garage,
  PlatformSettingsConfig,
  PromoCodeConfig,
  UserProfile,
} from "@/types/domain";

const BGN_PER_EUR = 1.95583;

interface SubscriptionsManagementClientProps {
  initialUsers: UserProfile[];
  initialGarages: Garage[];
  initialSettings: PlatformSettingsConfig;
  stripeConfigured: boolean;
}

function parseNum(raw: string, fallback: number): number {
  const normalized = raw.trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 100) / 100;
}

export function SubscriptionsManagementClient({
  initialUsers,
  initialGarages,
  initialSettings,
  stripeConfigured,
}: SubscriptionsManagementClientProps) {
  const t = useTranslations("adminPanel.subscriptions");
  const locale = useLocale() as AppLocale;

  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [garages, setGarages] = useState<Garage[]>(initialGarages);
  const [settings, setSettings] =
    useState<PlatformSettingsConfig>(initialSettings);

  const [activeTab, setActiveTab] = useState<"users" | "garages" | "pricing">(
    "users"
  );
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "pro" | "free">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Pricing & promo drafts
  const [userPriceDraft, setUserPriceDraft] = useState(
    String(initialSettings.userProPlanPriceEur)
  );
  const [garagePriceDraft, setGaragePriceDraft] = useState(
    String(initialSettings.proPlanPriceEur)
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoPct, setNewPromoPct] = useState("20");
  const [newPromoTarget, setNewPromoTarget] = useState<
    "all" | "user" | "garage"
  >("all");

  const stats = useMemo(() => {
    const proUsers = users.filter((u) => (u.plan ?? "free") === "pro");
    const proGarages = garages.filter((g) => g.plan === "pro");
    const discountFactor = 1 - settings.annualBillingDiscountPct / 100;

    const userMrrEur = proUsers.reduce(
      (sum, u) =>
        sum +
        (u.billingCycle === "annual"
          ? settings.userProPlanPriceEur * discountFactor
          : settings.userProPlanPriceEur),
      0
    );
    const garageMrrEur = proGarages.reduce(
      (sum, g) =>
        sum +
        (g.billingCycle === "annual"
          ? settings.proPlanPriceEur * discountFactor
          : settings.proPlanPriceEur),
      0
    );

    return {
      totalUsers: users.length,
      proUsersCount: proUsers.length,
      totalGarages: garages.length,
      proGaragesCount: proGarages.length,
      mrrEur: Number((userMrrEur + garageMrrEur).toFixed(2)),
      activePromos: settings.promoCodes.filter((p) => p.active).length,
    };
  }, [users, garages, settings]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const p = u.plan ?? "free";
      if (planFilter !== "all" && p !== planFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.stripeCustomerId ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, planFilter]);

  const ownerByUid = useMemo(
    () => new Map(users.map((u) => [u.uid, u])),
    [users]
  );

  const filteredGarages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return garages.filter((g) => {
      if (planFilter !== "all" && g.plan !== planFilter) return false;
      if (!q) return true;
      const owner = ownerByUid.get(g.ownerUid);
      return (
        g.name.toLowerCase().includes(q) ||
        g.city.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        (owner?.email ?? "").toLowerCase().includes(q) ||
        (g.stripeCustomerId ?? "").toLowerCase().includes(q)
      );
    });
  }, [garages, ownerByUid, search, planFilter]);

  const updateUserPlan = async (
    uid: string,
    userPlan: "free" | "pro",
    billingCycle?: "monthly" | "annual"
  ) => {
    setBusyId(uid);
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPlan, billingCycle }),
      });
      if (!res.ok) {
        toast.error(t("updateErrorToast"));
        return;
      }

      const nowIso = new Date().toISOString();
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? {
                ...u,
                plan: userPlan,
                subscriptionStatus: userPlan === "pro" ? "active" : "canceled",
                billingCycle:
                  userPlan === "pro" ? billingCycle ?? "monthly" : null,
                planUpdatedAt: nowIso,
              }
            : u
        )
      );
      toast.success(t("userUpdatedToast"));
    } finally {
      setBusyId(null);
    }
  };

  const updateGaragePlan = async (
    garageId: string,
    plan: "free" | "pro",
    billingCycle?: "monthly" | "annual"
  ) => {
    setBusyId(garageId);
    try {
      const res = await fetch(`/api/admin/garages/${garageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      });
      if (!res.ok) {
        toast.error(t("updateErrorToast"));
        return;
      }

      const nowIso = new Date().toISOString();
      setGarages((prev) =>
        prev.map((g) =>
          g.id === garageId
            ? {
                ...g,
                plan,
                monthlyReminderQuota: plan === "pro" ? 500 : 50,
                subscriptionStatus: plan === "pro" ? "active" : "canceled",
                billingCycle: plan === "pro" ? billingCycle ?? "monthly" : null,
                planUpdatedAt: nowIso,
              }
            : g
        )
      );
      toast.success(t("garageUpdatedToast"));
    } finally {
      setBusyId(null);
    }
  };

  const handleAddPromo = () => {
    const cleanCode = newPromoCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "");
    const pct = Number(newPromoPct);
    if (cleanCode.length < 2 || !(pct >= 1 && pct <= 90)) {
      toast.error(t("promoValidationError"));
      return;
    }
    if (settings.promoCodes.some((p) => p.code === cleanCode)) {
      toast.error(t("promoDuplicateError"));
      return;
    }
    const nextItem: PromoCodeConfig = {
      code: cleanCode,
      discountPct: Math.round(pct),
      active: true,
      appliesTo: newPromoTarget,
    };
    setSettings((cur) => ({
      ...cur,
      promoCodes: [...cur.promoCodes, nextItem],
    }));
    setNewPromoCode("");
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const nextUserPrice = parseNum(
        userPriceDraft,
        settings.userProPlanPriceEur
      );
      const nextGaragePrice = parseNum(
        garagePriceDraft,
        settings.proPlanPriceEur
      );

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSubscriptionsEnabled: settings.userSubscriptionsEnabled,
          garageSubscriptionsEnabled: settings.garageSubscriptionsEnabled,
          userProPlanPriceEur: nextUserPrice,
          proPlanPriceEur: nextGaragePrice,
          freeUserVehicleLimit: settings.freeUserVehicleLimit,
          freeGarageMonthlyWorkOrders: settings.freeGarageMonthlyWorkOrders,
          annualBillingDiscountPct: settings.annualBillingDiscountPct,
          promoCodes: settings.promoCodes,
        }),
      });
      if (!res.ok) {
        toast.error(t("updateErrorToast"));
        return;
      }

      const json = (await res.json()) as { settings: PlatformSettingsConfig };
      setSettings(json.settings);
      setUserPriceDraft(String(json.settings.userProPlanPriceEur));
      setGaragePriceDraft(String(json.settings.proPlanPriceEur));
      toast.success(t("settingsSavedToast"));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <CreditCard className="h-6 w-6 text-primary" />
            {t("pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        <Badge
          variant={stripeConfigured ? "success" : "secondary"}
          className="px-3 py-1 font-mono text-xs"
        >
          {stripeConfigured ? t("stripeLiveBadge") : t("stripeSimBadge")}
        </Badge>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("kpiProUsers")}</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {stats.proUsersCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {stats.totalUsers}
            </span>
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("kpiProGarages")}</span>
            <Building2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {stats.proGaragesCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {stats.totalGarages}
            </span>
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("kpiEstimatedMrr")}</span>
            <Coins className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            €{stats.mrrEur.toFixed(2)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            ≈ {(stats.mrrEur * BGN_PER_EUR).toFixed(2)} лв. / ARR €
            {(stats.mrrEur * 12).toFixed(0)}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("kpiPromosAndDiscount")}</span>
            <Tag className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {stats.activePromos}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("annualDiscountLabel")}: -{settings.annualBillingDiscountPct}%
          </p>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Button
          type="button"
          variant={activeTab === "users" ? "gradient" : "outline"}
          size="sm"
          onClick={() => setActiveTab("users")}
        >
          <Users className="h-4 w-4" />
          {t("tabUsers")} ({users.length})
        </Button>
        <Button
          type="button"
          variant={activeTab === "garages" ? "gradient" : "outline"}
          size="sm"
          onClick={() => setActiveTab("garages")}
        >
          <Building2 className="h-4 w-4" />
          {t("tabGarages")} ({garages.length})
        </Button>
        <Button
          type="button"
          variant={activeTab === "pricing" ? "gradient" : "outline"}
          size="sm"
          onClick={() => setActiveTab("pricing")}
        >
          <Tag className="h-4 w-4" />
          {t("tabPricingAndPromos")}
        </Button>
      </div>

      {/* Users / Garages Search + Plan Filter */}
      {activeTab !== "pricing" ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>

          <Select
            value={planFilter}
            onValueChange={(v) => setPlanFilter(v as "all" | "pro" | "free")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="pro">{t("filterPro")}</SelectItem>
              <SelectItem value="free">{t("filterFree")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* TAB 1: DRIVER SUBSCRIPTIONS */}
      {activeTab === "users" ? (
        filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
          />
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const plan = u.plan ?? "free";
              const isPro = plan === "pro";
              const isBusy = busyId === u.uid;

              return (
                <Card
                  key={u.uid}
                  className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {u.displayName}
                      </span>
                      <Badge variant={isPro ? "success" : "secondary"}>
                        {isPro ? (
                          <span className="inline-flex items-center gap-1">
                            <Crown className="h-3 w-3" /> PRO
                          </span>
                        ) : (
                          "FREE"
                        )}
                      </Badge>
                      {u.billingCycle && isPro ? (
                        <Badge variant="outline" className="text-[11px]">
                          {u.billingCycle}
                        </Badge>
                      ) : null}
                      {u.subscriptionStatus ? (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {u.subscriptionStatus}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email} • {u.role}
                      {u.planUpdatedAt
                        ? ` • ${formatDateShort(u.planUpdatedAt, locale)}`
                        : ""}
                    </p>
                    {u.stripeCustomerId ? (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Stripe: {u.stripeCustomerId}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isPro ? (
                      <>
                        {u.billingCycle !== "annual" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() =>
                              void updateUserPlan(u.uid, "pro", "annual")
                            }
                          >
                            {t("switchAnnualBtn")}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() =>
                              void updateUserPlan(u.uid, "pro", "monthly")
                            }
                          >
                            {t("switchMonthlyBtn")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={isBusy}
                          onClick={() => void updateUserPlan(u.uid, "free")}
                        >
                          {t("revertFreeBtn")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() =>
                            void updateUserPlan(u.uid, "pro", "monthly")
                          }
                        >
                          {t("grantMonthlyBtn")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="gradient"
                          disabled={isBusy}
                          onClick={() =>
                            void updateUserPlan(u.uid, "pro", "annual")
                          }
                        >
                          {t("grantAnnualBtn")}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {/* TAB 2: GARAGE SUBSCRIPTIONS */}
      {activeTab === "garages" ? (
        filteredGarages.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
          />
        ) : (
          <div className="space-y-3">
            {filteredGarages.map((g) => {
              const isPro = g.plan === "pro";
              const isBusy = busyId === g.id;
              const owner = ownerByUid.get(g.ownerUid);

              return (
                <Card
                  key={g.id}
                  className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {g.name}
                      </span>
                      <Badge variant={isPro ? "success" : "secondary"}>
                        {isPro ? (
                          <span className="inline-flex items-center gap-1">
                            <Crown className="h-3 w-3" /> PRO
                          </span>
                        ) : (
                          "FREE"
                        )}
                      </Badge>
                      {g.billingCycle && isPro ? (
                        <Badge variant="outline" className="text-[11px]">
                          {g.billingCycle}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {g.monthlyRemindersUsed ?? 0} /{" "}
                        {g.monthlyReminderQuota ?? (isPro ? 500 : 50)} SMS/Email
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {g.city} • /{g.slug}
                      {owner ? ` • ${owner.email}` : ""}
                      {g.planUpdatedAt
                        ? ` • ${formatDateShort(g.planUpdatedAt, locale)}`
                        : ""}
                    </p>
                    {g.stripeCustomerId ? (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Stripe: {g.stripeCustomerId}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isPro ? (
                      <>
                        {g.billingCycle !== "annual" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() =>
                              void updateGaragePlan(g.id, "pro", "annual")
                            }
                          >
                            {t("switchAnnualBtn")}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() =>
                              void updateGaragePlan(g.id, "pro", "monthly")
                            }
                          >
                            {t("switchMonthlyBtn")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={isBusy}
                          onClick={() => void updateGaragePlan(g.id, "free")}
                        >
                          {t("revertFreeBtn")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() =>
                            void updateGaragePlan(g.id, "pro", "monthly")
                          }
                        >
                          {t("grantMonthlyBtn")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="gradient"
                          disabled={isBusy}
                          onClick={() =>
                            void updateGaragePlan(g.id, "pro", "annual")
                          }
                        >
                          {t("grantAnnualBtn")}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {/* TAB 3: PRICING, FREE TIER LIMITS & PROMO CODES */}
      {activeTab === "pricing" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="space-y-5 p-6 lg:col-span-6">
            <h2 className="text-lg font-semibold text-foreground">
              {t("pricingConfigHeading")}
            </h2>

            {/* Feature Toggles */}
            <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="sub-user-toggle">
                  {t("enableUserSubsLabel")}
                </Label>
                <Switch
                  id="sub-user-toggle"
                  checked={settings.userSubscriptionsEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({
                      ...s,
                      userSubscriptionsEnabled: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <Label htmlFor="sub-garage-toggle">
                  {t("enableGarageSubsLabel")}
                </Label>
                <Switch
                  id="sub-garage-toggle"
                  checked={settings.garageSubscriptionsEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({
                      ...s,
                      garageSubscriptionsEnabled: checked,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sub-user-price">
                  {t("userProPriceLabel")}
                </Label>
                <Input
                  id="sub-user-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={userPriceDraft}
                  onChange={(e) => setUserPriceDraft(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-garage-price">
                  {t("garageProPriceLabel")}
                </Label>
                <Input
                  id="sub-garage-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={garagePriceDraft}
                  onChange={(e) => setGaragePriceDraft(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-user-limit">
                  {t("freeVehicleLimitLabel")}
                </Label>
                <Input
                  id="sub-user-limit"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.freeUserVehicleLimit}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      freeUserVehicleLimit: Math.max(
                        1,
                        Number(e.target.value) || 1
                      ),
                    }))
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-garage-limit">
                  {t("freeWorkOrderLimitLabel")}
                </Label>
                <Input
                  id="sub-garage-limit"
                  type="number"
                  min="1"
                  max="10000"
                  value={settings.freeGarageMonthlyWorkOrders}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      freeGarageMonthlyWorkOrders: Math.max(
                        1,
                        Number(e.target.value) || 1
                      ),
                    }))
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sub-annual-discount">
                  {t("annualDiscountInputLabel")}
                </Label>
                <Input
                  id="sub-annual-discount"
                  type="number"
                  min="0"
                  max="80"
                  value={settings.annualBillingDiscountPct}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      annualBillingDiscountPct: Math.min(
                        80,
                        Math.max(0, Number(e.target.value) || 0)
                      ),
                    }))
                  }
                  className="font-mono"
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-5 p-6 lg:col-span-6">
            <h2 className="text-lg font-semibold text-foreground">
              {t("promoCodesHeading")}
            </h2>

            <div className="grid gap-2 sm:grid-cols-12">
              <Input
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                placeholder="VELTROX20"
                className="font-mono uppercase sm:col-span-4"
              />
              <Input
                type="number"
                min="1"
                max="90"
                value={newPromoPct}
                onChange={(e) => setNewPromoPct(e.target.value)}
                placeholder="%"
                className="font-mono sm:col-span-3"
              />
              <div className="sm:col-span-3">
                <Select
                  value={newPromoTarget}
                  onValueChange={(v) =>
                    setNewPromoTarget(v as "all" | "user" | "garage")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("promoTargetAll")}</SelectItem>
                    <SelectItem value="user">{t("promoTargetUser")}</SelectItem>
                    <SelectItem value="garage">
                      {t("promoTargetGarage")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="sm:col-span-2"
                onClick={handleAddPromo}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {settings.promoCodes.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noPromoCodes")}
              </p>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border">
                {settings.promoCodes.map((promo) => (
                  <div
                    key={promo.code}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="violet" className="font-mono">
                        {promo.code}
                      </Badge>
                      <span className="font-mono font-semibold text-foreground">
                        -{promo.discountPct}%
                      </span>
                      <Badge variant="outline" className="text-[11px]">
                        {promo.appliesTo ?? "all"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={promo.active}
                        onCheckedChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            promoCodes: s.promoCodes.map((p) =>
                              p.code === promo.code
                                ? { ...p, active: checked }
                                : p
                            ),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            promoCodes: s.promoCodes.filter(
                              (p) => p.code !== promo.code
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="gradient"
                disabled={savingSettings}
                onClick={() => void handleSaveSettings()}
              >
                {savingSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("saveConfigBtn")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

