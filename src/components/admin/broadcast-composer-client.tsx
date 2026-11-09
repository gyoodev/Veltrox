"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Loader2,
  Send,
  Sparkles,
  Users,
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
import { Textarea } from "@/components/ui/textarea";
import type { AppNotification } from "@/types/domain";

interface BroadcastComposerClientProps {
  recentNotifications: AppNotification[];
  totalUsersCount: number;
  totalGaragesCount: number;
}

export function BroadcastComposerClient({
  recentNotifications,
  totalUsersCount,
  totalGaragesCount,
}: BroadcastComposerClientProps) {
  const [target, setTarget] = useState<
    "everyone" | "all_users" | "all_garages" | "specific_email"
  >("everyone");
  const [specificEmail, setSpecificEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "critical">(
    "normal"
  );
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AppNotification[]>(recentNotifications);

  const estimatedAudience =
    target === "everyone"
      ? totalUsersCount
      : target === "all_users"
        ? Math.max(0, totalUsersCount - totalGaragesCount)
        : target === "all_garages"
          ? totalGaragesCount
          : 1;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.error("Моля, попълнете заглавие и съдържание на съобщението");
      return;
    }

    if (target === "specific_email" && !specificEmail.trim()) {
      toast.error("Моля, въведете имейл на получателя");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          specificEmail: target === "specific_email" ? specificEmail.trim() : "",
          subject: subject.trim(),
          body: body.trim(),
          actionUrl: actionUrl.trim() || undefined,
          priority,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Грешка при изпращане на известието");
        return;
      }

      toast.success(
        data.message || `Известието е изпратено до ${data.sentCount} потребители!`
      );

      // Add to local preview history
      const newMockItem: AppNotification = {
        id: "broadcast-" + Date.now(),
        ownerId: target === "specific_email" ? specificEmail : null,
        garageId: null,
        channel: "in_app",
        subject: subject.trim(),
        body: body.trim(),
        actionUrl: actionUrl.trim() || null,
        status: "sent",
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [newMockItem, ...prev]);

      // Reset form
      setSubject("");
      setBody("");
      setActionUrl("");
      setSpecificEmail("");
    } catch {
      toast.error("Грешка при връзка със сървъра");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
          <Send className="h-7 w-7 text-primary" />
          Глобални известия и съобщения
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Директно изпращане на системни съобщения, промоции или важни предупреждения към потребители и автосервизи.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Composer Form */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-primary/25 bg-card/70 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Ново известие
              </CardTitle>
              <CardDescription>
                Съобщението ще се появи веднага в камбанката за известия на избраните потребители.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSend} className="space-y-4">
                {/* Target Audience */}
                <div className="space-y-2">
                  <Label>Целева аудитория</Label>
                  <Select
                    value={target}
                    onValueChange={(v) =>
                      setTarget(
                        v as
                          | "everyone"
                          | "all_users"
                          | "all_garages"
                          | "specific_email"
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">
                        Всички регистрирани (Шофьори + Сервизи)
                      </SelectItem>
                      <SelectItem value="all_users">
                        Само индивидуални шофьори
                      </SelectItem>
                      <SelectItem value="all_garages">
                        Само собственици на автосервизи
                      </SelectItem>
                      <SelectItem value="specific_email">
                        Конкретен потребител по имейл
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono pt-0.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>Приблизителен обхват: ~{estimatedAudience} акаунта</span>
                  </div>
                </div>

                {target === "specific_email" ? (
                  <div className="space-y-2">
                    <Label htmlFor="specific-email">Имейл адрес на получателя</Label>
                    <Input
                      id="specific-email"
                      type="email"
                      placeholder="driver@example.com"
                      value={specificEmail}
                      onChange={(e) => setSpecificEmail(e.target.value)}
                      required
                    />
                  </div>
                ) : null}

                {/* Priority */}
                <div className="space-y-2">
                  <Label>Ниво на важност</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={priority === "normal" ? "secondary" : "outline"}
                      onClick={() => setPriority("normal")}
                      className="text-xs h-8"
                    >
                      <Info className="h-3.5 w-3.5 mr-1 text-primary" />
                      Стандартно (Инфо)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={priority === "important" ? "secondary" : "outline"}
                      onClick={() => setPriority("important")}
                      className="text-xs h-8 border-amber-500/40"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-400" />
                      Важно съобщение
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={priority === "critical" ? "secondary" : "outline"}
                      onClick={() => setPriority("critical")}
                      className="text-xs h-8 border-destructive/40 text-destructive"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Критично
                    </Button>
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Заглавие на известието</Label>
                  <Input
                    id="subject"
                    placeholder="напр. Предстояща профилактика на платформата или Ново напомняне..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <Label htmlFor="body">Текст на съобщението</Label>
                  <Textarea
                    id="body"
                    placeholder="Въведете детайли за потребителите..."
                    rows={4}
                    value={body}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                    maxLength={1000}
                    required
                  />
                </div>

                {/* Action URL */}
                <div className="space-y-2">
                  <Label htmlFor="action-url">
                    Линк за действие (Опционален)
                  </Label>
                  <Input
                    id="action-url"
                    placeholder="/app/cars или https://..."
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ако попълните линк, потребителят ще може да кликне върху известието и да отиде на съответната страница.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="gradient"
                    disabled={sending}
                    className="gap-2 px-6"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>{sending ? "Изпращане..." : "Изпрати известието"}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview & Recent History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Preview Card */}
          <Card className="border-border/70 bg-secondary/15">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Визуализация в приложението (Live Preview)
              </CardTitle>
              <CardDescription>
                Точно така ще изглежда известието в камбанката на потребителя.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-primary/20 bg-background/80 p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs font-bold text-foreground">
                      {subject.trim() || "Заглавие на съобщението"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Току-що
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                  {body.trim() ||
                    "Тук ще се визуализира съдържанието на вашето известие, когато потребителят отвори списъка със съобщения."}
                </p>
                {actionUrl.trim() ? (
                  <div className="pl-9 pt-1">
                    <span className="text-[11px] text-primary underline font-medium">
                      Към линка: {actionUrl}
                    </span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Recent Broadcasts */}
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Последни изпратени съобщения ({history.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Все още няма изпратени известия.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {history.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-border/50 bg-secondary/30 p-2.5 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground truncate max-w-[200px]">
                          {n.subject}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {n.createdAt ? n.createdAt.slice(0, 10) : "днес"}
                          </span>
                        </div>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-[11px]">
                        {n.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
