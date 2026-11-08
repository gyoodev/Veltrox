"use client";

import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { PlatformContentConfig, PlatformFaqItem } from "@/types/domain";

interface CmsEditorClientProps {
  initialContent: PlatformContentConfig;
}

export function CmsEditorClient({ initialContent }: CmsEditorClientProps) {
  const t = useTranslations("adminPanel.cms");

  const [banner, setBanner] = useState(initialContent.banner);
  const [faqs, setFaqs] = useState<PlatformFaqItem[]>(initialContent.faqs);
  const [saving, setSaving] = useState(false);

  const handleAddFaq = () => {
    setFaqs((prev) => [
      ...prev,
      {
        id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        questionBg: "",
        answerBg: "",
        questionEn: "",
        answerEn: "",
        order: prev.length,
      },
    ]);
  };

  const handleMoveFaq = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= faqs.length) return;
    const copy = [...faqs];
    const current = copy[index];
    const target = copy[nextIndex];
    if (!current || !target) return;
    copy[index] = target;
    copy[nextIndex] = current;
    setFaqs(copy.map((item, idx) => ({ ...item, order: idx })));
  };

  const handleUpdateFaq = (
    id: string,
    field: keyof Omit<PlatformFaqItem, "id" | "order">,
    value: string
  ) => {
    setFaqs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteFaq = (id: string) => {
    setFaqs((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, idx) => ({ ...item, order: idx }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banner: {
            ...banner,
            linkUrl: banner.linkUrl?.trim() ? banner.linkUrl.trim() : null,
            linkLabelBg: banner.linkLabelBg?.trim()
              ? banner.linkLabelBg.trim()
              : null,
            linkLabelEn: banner.linkLabelEn?.trim()
              ? banner.linkLabelEn.trim()
              : null,
          },
          faqs: faqs.map((item, idx) => ({ ...item, order: idx })),
        }),
      });

      if (!res.ok) {
        toast.error(t("saveErrorToast"));
        return;
      }

      toast.success(t("savedToast"));
    } catch {
      toast.error(t("saveErrorToast"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
          disabled={saving}
          onClick={() => void handleSave()}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? t("savingBtn") : t("saveBtn")}
        </Button>
      </div>

      {/* Announcement Banner Configurator */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t("bannerTitle")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("bannerSubtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Label htmlFor="banner-enabled-switch" className="text-xs">
                {banner.enabled ? t("bannerActive") : t("bannerInactive")}
              </Label>
              <Switch
                id="banner-enabled-switch"
                checked={banner.enabled}
                onCheckedChange={(checked) =>
                  setBanner((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("variantLabel")}</Label>
              <Select
                value={banner.variant}
                onValueChange={(v) =>
                  setBanner((prev) => ({
                    ...prev,
                    variant: v as "info" | "warning" | "success",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info (Cobalt)</SelectItem>
                  <SelectItem value="warning">Warning (Amber)</SelectItem>
                  <SelectItem value="success">Success (Emerald)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="banner-link-url">{t("linkUrlLabel")}</Label>
              <Input
                id="banner-link-url"
                value={banner.linkUrl ?? ""}
                onChange={(e) =>
                  setBanner((prev) => ({ ...prev, linkUrl: e.target.value }))
                }
                placeholder="/garages"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="banner-msg-bg">{t("messageBgLabel")}</Label>
              <Input
                id="banner-msg-bg"
                value={banner.messageBg}
                onChange={(e) =>
                  setBanner((prev) => ({ ...prev, messageBg: e.target.value }))
                }
                placeholder="Планирана поддръжка в неделя от 02:00 до 03:00 ч."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-msg-en">{t("messageEnLabel")}</Label>
              <Input
                id="banner-msg-en"
                value={banner.messageEn}
                onChange={(e) =>
                  setBanner((prev) => ({ ...prev, messageEn: e.target.value }))
                }
                placeholder="Scheduled maintenance Sunday 02:00–03:00 EET."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="banner-cta-bg">{t("linkLabelBg")}</Label>
              <Input
                id="banner-cta-bg"
                value={banner.linkLabelBg ?? ""}
                onChange={(e) =>
                  setBanner((prev) => ({
                    ...prev,
                    linkLabelBg: e.target.value,
                  }))
                }
                placeholder="Научи повече"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-cta-en">{t("linkLabelEn")}</Label>
              <Input
                id="banner-cta-en"
                value={banner.linkLabelEn ?? ""}
                onChange={(e) =>
                  setBanner((prev) => ({
                    ...prev,
                    linkLabelEn: e.target.value,
                  }))
                }
                placeholder="Learn more"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Bilingual FAQ Manager */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t("faqTitle")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("faqSubtitle")}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddFaq}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addFaqBtn")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
              {t("faqFallbackHint")}
            </div>
          ) : (
            faqs.map((item, idx) => (
              <div
                key={item.id}
                className="space-y-3 rounded-2xl border border-border bg-secondary/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono">
                    #{idx + 1}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === 0}
                      aria-label={t("moveUpAria")}
                      onClick={() => handleMoveFaq(idx, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === faqs.length - 1}
                      aria-label={t("moveDownAria")}
                      onClick={() => handleMoveFaq(idx, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("deleteFaqAria")}
                      onClick={() => handleDeleteFaq(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("questionBgLabel")}</Label>
                    <Input
                      value={item.questionBg}
                      onChange={(e) =>
                        handleUpdateFaq(item.id, "questionBg", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("questionEnLabel")}</Label>
                    <Input
                      value={item.questionEn}
                      onChange={(e) =>
                        handleUpdateFaq(item.id, "questionEn", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("answerBgLabel")}</Label>
                    <Input
                      value={item.answerBg}
                      onChange={(e) =>
                        handleUpdateFaq(item.id, "answerBg", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("answerEnLabel")}</Label>
                    <Input
                      value={item.answerEn}
                      onChange={(e) =>
                        handleUpdateFaq(item.id, "answerEn", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

