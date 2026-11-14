"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Database,
  Download,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import type { PlatformSettingsConfig, PromoCodeConfig } from "@/types/domain";

interface IntegrationStatus {
  stripe: boolean;
  email: boolean;
  sms: boolean;
  viber: boolean;
  webPush: boolean;
}

interface PlatformSettingsClientProps {
  initialSettings: PlatformSettingsConfig;
  integrationStatus?: IntegrationStatus;
}

const BGN_PER_EUR = 1.95583;

function parsePriceInput(raw: string, fallback: number): number {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 100) / 100;
}

export function PlatformSettingsClient({
  initialSettings,
  integrationStatus,
}: PlatformSettingsClientProps) {
  const [settings, setSettings] = useState<PlatformSettingsConfig>(initialSettings);
  const [proPriceDraft, setProPriceDraft] = useState<string>(
    String(initialSettings.proPlanPriceEur)
  );
  const [userProPriceDraft, setUserProPriceDraft] = useState<string>(
    String(initialSettings.userProPlanPriceEur)
  );
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoDiscountPct, setNewPromoDiscountPct] = useState("20");
  const [newPromoTarget, setNewPromoTarget] = useState<
    "all" | "user" | "garage"
  >("all");
  const [saving, setSaving] = useState(false);
  const [testingApis, setTestingApis] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<{
    bgtoll?: boolean;
    gf?: boolean;
    rta?: boolean;
  } | null>(null);

  const handleSave = async () => {
    const nextProPrice = parsePriceInput(proPriceDraft, settings.proPlanPriceEur);
    const nextUserProPrice = parsePriceInput(
      userProPriceDraft,
      settings.userProPlanPriceEur
    );
    const payload: PlatformSettingsConfig = {
      ...settings,
      proPlanPriceEur: nextProPrice,
      userProPlanPriceEur: nextUserProPrice,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error("Неуспешно запазване на системните настройки");
        return;
      }

      const json = (await res.json()) as { settings: PlatformSettingsConfig };
      setSettings(json.settings);
      setProPriceDraft(String(json.settings.proPlanPriceEur));
      setUserProPriceDraft(String(json.settings.userProPlanPriceEur));
      toast.success("Системните настройки са обновени успешно в Firestore!");
    } catch {
      toast.error("Възникна грешка при запазване на настройките");
    } finally {
      setSaving(false);
    }
  };

  const handleTestIntegrations = async () => {
    setTestingApis(true);
    try {
      const results = { bgtoll: false, gf: false, rta: false };

      // 1. Test BGTOLL
      try {
        const bgRes = await fetch("/api/compliance/check-bgtoll?plate=CB1234AB");
        results.bgtoll = bgRes.status !== 500 && bgRes.status !== 503;
      } catch {
        results.bgtoll = false;
      }

      // 2. Test RTA Captcha
      try {
        const rtaRes = await fetch("/api/compliance/rta-captcha");
        results.rta = rtaRes.ok;
      } catch {
        results.rta = false;
      }

      // 3. Test GF Challenge
      try {
        const gfRes = await fetch("/api/compliance/gf-challenge");
        results.gf = gfRes.ok;
      } catch {
        results.gf = false;
      }

      setApiStatuses(results);
      toast.success("Тестът на външните интеграции завърши успешно!");
    } catch {
      toast.error("Грешка при тестване на външните услуги");
    } finally {
      setTestingApis(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Save Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <Sliders className="h-7 w-7 text-primary" />
            Глобален контрол и Feature Flags
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управлявайте функционалностите на Veltrox в реално време без нужда от рестарт на сървъра.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="gradient"
            onClick={handleSave}
            disabled={saving}
            className="gap-2 px-5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{saving ? "Запазване..." : "Запази промените"}</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Feature Toggles */}
        <div className="lg:col-span-8 space-y-6">
          {/* Emergency & Maintenance Controls */}
          <Card
            className={
              settings.maintenanceMode
                ? "border-destructive/60 bg-destructive/[0.04]"
                : "border-primary/25 bg-card/60"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert
                    className={`h-5 w-5 ${
                      settings.maintenanceMode
                        ? "text-destructive"
                        : "text-amber-400"
                    }`}
                  />
                  Спешен контрол и Профилактика (Maintenance Mode)
                </CardTitle>
                <Badge
                  variant={settings.maintenanceMode ? "destructive" : "success"}
                  className="font-mono text-xs"
                >
                  {settings.maintenanceMode ? "АКТИВЕН РЕЖИМ" : "НОРМАЛЕН РЕЖИМ"}
                </Badge>
              </div>
              <CardDescription>
                Когато режимът на профилактика е включен, платформата показва информационно съобщение за поддръжка.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 p-3.5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">
                    Включи режим на профилактика
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Блокира достъпа за обикновени потребители до приключване на работата.
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, maintenanceMode: checked }))
                  }
                />
              </div>

              {settings.maintenanceMode ? (
                <div className="space-y-2 pt-1">
                  <Label htmlFor="maintenance-msg">
                    Съобщение за потребителите при профилактика
                  </Label>
                  <Textarea
                    id="maintenance-msg"
                    rows={2}
                    value={settings.maintenanceMessage}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setSettings((prev) => ({
                        ...prev,
                        maintenanceMessage: e.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Access & Registration Controls */}
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Контрол на регистрациите и сервизите
              </CardTitle>
              <CardDescription>
                Управлявайте дали нови потребители или автосервизи могат да създават профили.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 p-3.5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">
                    Разреши регистрация на нови потребители
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Позволява на нови шофьори да се регистрират свободно през формата за регистрация.
                  </p>
                </div>
                <Switch
                  checked={settings.allowRegistrations}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      allowRegistrations: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 p-3.5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">
                    Разреши нови заявки за автосервизи
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Позволява подаване на нови молби за включване на сервизи в мрежата на Veltrox.
                  </p>
                </div>
                <Switch
                  checked={settings.allowGarageApplications}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      allowGarageApplications: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 p-3.5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">
                    Автоматични проверки на срокове (BGTOLL / ГФ / РТА)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Глобален превключвател за модулите за проверка на валидност на винетки, ГО и прегледи.
                  </p>
                </div>
                <Switch
                  checked={settings.complianceChecksEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      complianceChecksEnabled: checked,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Subscriptions Management (Business & Users) */}
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                Бизнес и потребителски абонаменти
              </CardTitle>
              <CardDescription>
                Конфигурация на базовата валута, ценовите планове и абонаментите за автосервизи и потребители.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                <div className="space-y-2">
                  <Label>Основна валута на платформата</Label>
                  <Select
                    value={settings.defaultCurrency}
                    onValueChange={(v) =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultCurrency: v as "BGN" | "EUR",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€) - Европейска валута</SelectItem>
                      <SelectItem value="BGN">BGN (лв) - Български лев</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/25 px-3.5 py-2.5 text-xs text-muted-foreground">
                  {settings.defaultCurrency === "BGN"
                    ? "Цените на началната страница се конвертират автоматично в лева (1 EUR = 1.95583 BGN)."
                    : "Цените се съхраняват и показват директно в евро (€)."}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Business / Garage Subscription Management */}
                <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          Бизнес абонамент (Сервизи)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Абонаментни планове и Pro достъп за автосервизи.
                      </p>
                    </div>
                    <Switch
                      aria-label="Активни бизнес абонаменти"
                      checked={settings.garageSubscriptionsEnabled}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          garageSubscriptionsEnabled: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pro-price">
                      Месечна такса за Garage Pro (€)
                    </Label>
                    <Input
                      id="pro-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={proPriceDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setProPriceDraft(raw);
                        if (raw.trim() !== "") {
                          const parsed = Number.parseFloat(raw.replace(",", "."));
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            setSettings((prev) => ({
                              ...prev,
                              proPlanPriceEur: Math.round(parsed * 100) / 100,
                            }));
                          }
                        }
                      }}
                      onBlur={() => {
                        const parsed = parsePriceInput(
                          proPriceDraft,
                          settings.proPlanPriceEur
                        );
                        setSettings((prev) => ({ ...prev, proPlanPriceEur: parsed }));
                        setProPriceDraft(String(parsed));
                      }}
                    />
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Free: €0 • Pro: €{settings.proPlanPriceEur.toFixed(2)}
                      {settings.defaultCurrency === "BGN"
                        ? ` (≈ ${(settings.proPlanPriceEur * BGN_PER_EUR).toFixed(2)} лв.)`
                        : ""}
                    </p>
                  </div>

                  <div className="pt-1 border-t border-border/50 flex items-center justify-between text-xs">
                    <Badge
                      variant={
                        settings.garageSubscriptionsEnabled ? "success" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {settings.garageSubscriptionsEnabled ? "АКТИВЕН" : "СПРЯН"}
                    </Badge>
                    <Link
                      href="/admin/garages"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Сервизни планове
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {/* User / Driver Subscription Management */}
                <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-violet-400" />
                        <span className="text-sm font-semibold text-foreground">
                          Потребителски абонамент (Шофьори)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Абонаментни планове и Driver Pro за собственици на автомобили.
                      </p>
                    </div>
                    <Switch
                      aria-label="Активни потребителски абонаменти"
                      checked={settings.userSubscriptionsEnabled}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          userSubscriptionsEnabled: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="user-pro-price">
                      Месечна такса за Driver Pro (€)
                    </Label>
                    <Input
                      id="user-pro-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={userProPriceDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setUserProPriceDraft(raw);
                        if (raw.trim() !== "") {
                          const parsed = Number.parseFloat(raw.replace(",", "."));
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            setSettings((prev) => ({
                              ...prev,
                              userProPlanPriceEur: Math.round(parsed * 100) / 100,
                            }));
                          }
                        }
                      }}
                      onBlur={() => {
                        const parsed = parsePriceInput(
                          userProPriceDraft,
                          settings.userProPlanPriceEur
                        );
                        setSettings((prev) => ({
                          ...prev,
                          userProPlanPriceEur: parsed,
                        }));
                        setUserProPriceDraft(String(parsed));
                      }}
                    />
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Free: €0 • Pro: €{settings.userProPlanPriceEur.toFixed(2)}
                      {settings.defaultCurrency === "BGN"
                        ? ` (≈ ${(settings.userProPlanPriceEur * BGN_PER_EUR).toFixed(2)} лв.)`
                        : ""}
                    </p>
                  </div>

                  <div className="pt-1 border-t border-border/50 flex items-center justify-between text-xs">
                    <Badge
                      variant={
                        settings.userSubscriptionsEnabled ? "violet" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {settings.userSubscriptionsEnabled ? "АКТИВЕН" : "СПРЯН"}
                    </Badge>
                    <Link
                      href="/admin/users"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Потребителски планове
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Free Tier Limits & Annual Discount */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="free-user-vehicles">
                    Лимит коли (Шофьор Free)
                  </Label>
                  <Input
                    id="free-user-vehicles"
                    type="number"
                    min={1}
                    max={1000}
                    value={settings.freeUserVehicleLimit}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(val) && val >= 1) {
                        setSettings((prev) => ({
                          ...prev,
                          freeUserVehicleLimit: val,
                        }));
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="free-garage-wo">
                    Поръчки/мес. (Сервиз Free)
                  </Label>
                  <Input
                    id="free-garage-wo"
                    type="number"
                    min={1}
                    max={100000}
                    value={settings.freeGarageMonthlyWorkOrders}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(val) && val >= 1) {
                        setSettings((prev) => ({
                          ...prev,
                          freeGarageMonthlyWorkOrders: val,
                        }));
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="annual-discount">
                    Отстъпка за годишен план (%)
                  </Label>
                  <Input
                    id="annual-discount"
                    type="number"
                    min={0}
                    max={80}
                    value={settings.annualBillingDiscountPct}
                    onChange={(e) => {
                      const val = Number.parseFloat(e.target.value);
                      if (Number.isFinite(val) && val >= 0) {
                        setSettings((prev) => ({
                          ...prev,
                          annualBillingDiscountPct: Math.min(80, val),
                        }));
                      }
                    }}
                  />
                </div>
              </div>

              {/* Promo Codes Builder */}
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    Промо кодове за отстъпка
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  <Input
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                    placeholder="НАПР. VELTROX20"
                    className="font-mono uppercase"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={newPromoDiscountPct}
                    onChange={(e) => setNewPromoDiscountPct(e.target.value)}
                    placeholder="% отстъпка"
                  />
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
                      <SelectItem value="all">Всички планове</SelectItem>
                      <SelectItem value="user">Driver Pro</SelectItem>
                      <SelectItem value="garage">Garage Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const clean = newPromoCode
                        .trim()
                        .toUpperCase()
                        .replace(/[^A-Z0-9_-]/g, "");
                      const pct = Number.parseFloat(newPromoDiscountPct);
                      if (clean.length < 2 || !Number.isFinite(pct) || pct < 1) {
                        toast.error("Въведете валиден промо код и % (1-90).");
                        return;
                      }
                      const nextCode: PromoCodeConfig = {
                        code: clean,
                        discountPct: Math.min(90, Math.round(pct * 100) / 100),
                        active: true,
                        appliesTo: newPromoTarget,
                      };
                      setSettings((prev) => ({
                        ...prev,
                        promoCodes: [
                          ...(prev.promoCodes ?? []).filter(
                            (p) => p.code !== clean
                          ),
                          nextCode,
                        ],
                      }));
                      setNewPromoCode("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Добави код
                  </Button>
                </div>

                {(settings.promoCodes ?? []).length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {settings.promoCodes.map((promo) => (
                      <div
                        key={promo.code}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">
                            {promo.code}
                          </span>
                          <Badge variant="violet">-{promo.discountPct}%</Badge>
                          <Badge variant="outline">
                            {promo.appliesTo ?? "all"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={promo.active}
                            onCheckedChange={(checked) =>
                              setSettings((prev) => ({
                                ...prev,
                                promoCodes: prev.promoCodes.map((p) =>
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
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                promoCodes: prev.promoCodes.filter(
                                  (p) => p.code !== promo.code
                                ),
                              }))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="gradient"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>{saving ? "Запазване..." : "Запази абонаментните настройки"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Database Snapshot & Integrations Status */}
        <div className="lg:col-span-4 space-y-6">
          {/* Disaster Recovery & Database Export */}
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Архивиране и бекъп на данни
              </CardTitle>
              <CardDescription>
                Сваляне на пълно JSON копие на всички Firestore колекции за сигурност.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Експортът съдържа потребители, сервизи, автомобили, поръчки, графици и напомняния в криптиран/саниран формат.
              </p>
              <Button
                variant="outline"
                className="w-full gap-2 text-xs h-9 font-medium"
                asChild
              >
                <a href="/api/admin/database-export" download>
                  <Download className="h-4 w-4" />
                  <span>Свали база данни (JSON Snapshot)</span>
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* External Integrations Health Tool */}
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-400" />
                  Статус на външни регистри
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={testingApis}
                  onClick={handleTestIntegrations}
                  className="h-7 px-2 text-[11px]"
                >
                  {testingApis ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  {testingApis ? "Тест..." : "Тествай сега"}
                </Button>
              </div>
              <CardDescription>
                Проверка на директната връзка със съответните държавни портали.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 font-mono text-xs">
              {/* BGTOLL */}
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-2.5">
                <span className="font-sans font-semibold text-foreground">
                  BGTOLL Винетка API
                </span>
                {apiStatuses?.bgtoll ? (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    ОНЛАЙН
                  </Badge>
                ) : apiStatuses?.bgtoll === false ? (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    ГРЕШКА
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    НЕ Е ТЕСТВАН
                  </Badge>
                )}
              </div>

              {/* Guarantee Fund */}
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-2.5">
                <span className="font-sans font-semibold text-foreground">
                  Гаранционен фонд (ГО)
                </span>
                {apiStatuses?.gf ? (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    ОНЛАЙН
                  </Badge>
                ) : apiStatuses?.gf === false ? (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    ГРЕШКА
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    НЕ Е ТЕСТВАН
                  </Badge>
                )}
              </div>

              {/* RTA */}
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-2.5">
                <span className="font-sans font-semibold text-foreground">
                  ИА АА / РТА (ГТП Портал)
                </span>
                {apiStatuses?.rta ? (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    ОНЛАЙН
                  </Badge>
                ) : apiStatuses?.rta === false ? (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    ГРЕШКА
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    НЕ Е ТЕСТВАН
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Messaging & Billing Providers Live / Simulated Status */}
          {integrationStatus ? (
            <Card className="border-border/70 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Комуникации и плащания (Live / Sim)
                </CardTitle>
                <CardDescription>
                  Автоматично превключване към реален API режим при зададени ключове в средата.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 font-mono text-xs">
                {[
                  { label: "Stripe Billing", live: integrationStatus.stripe },
                  { label: "Resend Email", live: integrationStatus.email },
                  { label: "Twilio SMS", live: integrationStatus.sms },
                  { label: "Viber Business", live: integrationStatus.viber },
                  { label: "Web Push (VAPID)", live: integrationStatus.webPush },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-2.5"
                  >
                    <span className="font-sans font-semibold text-foreground">
                      {item.label}
                    </span>
                    <Badge
                      variant={item.live ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {item.live ? "LIVE" : "SIMULATED"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Configuration Metadata */}
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 text-[11px] text-muted-foreground font-mono space-y-1">
            <p>Последна промяна: {settings.updatedAt || "Няма данни"}</p>
            {settings.updatedByUid ? (
              <p className="truncate">Редактирано от: {settings.updatedByUid}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
