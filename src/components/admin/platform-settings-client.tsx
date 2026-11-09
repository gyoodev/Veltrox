"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react";
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
import type { PlatformSettingsConfig } from "@/types/domain";

interface PlatformSettingsClientProps {
  initialSettings: PlatformSettingsConfig;
}

export function PlatformSettingsClient({
  initialSettings,
}: PlatformSettingsClientProps) {
  const [settings, setSettings] = useState<PlatformSettingsConfig>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [testingApis, setTestingApis] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<{
    bgtoll?: boolean;
    gf?: boolean;
    rta?: boolean;
  } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        toast.error("Неуспешно запазване на системните настройки");
        return;
      }

      const json = await res.json();
      setSettings(json.settings);
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

          {/* Pricing & Business Parameters */}
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                Бизнес параметри и абонаменти
              </CardTitle>
              <CardDescription>
                Конфигурация на базовата валута и ценовите планове за автосервизи.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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

              <div className="space-y-2">
                <Label htmlFor="pro-price">Месечна такса за Veltrox Pro (€)</Label>
                <Input
                  id="pro-price"
                  type="number"
                  min={0}
                  step={1}
                  value={settings.proPlanPriceEur}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      proPlanPriceEur: Number(e.target.value) || 0,
                    }))
                  }
                />
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
