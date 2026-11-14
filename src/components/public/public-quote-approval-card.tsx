"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AppLocale, QuoteStatus, WorkOrderQuoteItem } from "@/types/domain";

interface PublicQuoteApprovalCardProps {
  token: string;
  quoteStatus: QuoteStatus;
  quoteNotes: string | null;
  quoteItems: WorkOrderQuoteItem[];
  quoteTotalAmount: number;
  quoteRequestedAt: string | null;
  quoteRespondedAt: string | null;
  quoteCustomerComment: string | null;
  currency: "EUR" | "BGN";
}

export function PublicQuoteApprovalCard({
  token,
  quoteStatus: initialStatus,
  quoteNotes,
  quoteItems,
  quoteTotalAmount,
  quoteRequestedAt,
  quoteRespondedAt: initialRespondedAt,
  quoteCustomerComment: initialComment,
  currency,
}: PublicQuoteApprovalCardProps) {
  const t = useTranslations("publicStatus.quote");
  const tWo = useTranslations("garageWorkspace.workOrders");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [status, setStatus] = useState<QuoteStatus>(initialStatus);
  const [respondedAt, setRespondedAt] = useState<string | null>(
    initialRespondedAt
  );
  const [savedComment, setSavedComment] = useState<string | null>(
    initialComment
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "declined" | null>(
    null
  );

  if (status === "none") return null;

  const handleDecision = async (decision: "approved" | "declined") => {
    setSubmitting(decision);
    try {
      const res = await fetch(`/api/status/${encodeURIComponent(token)}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comment: comment.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error(t("submitError"));
        return;
      }

      const json = (await res.json()) as {
        quoteStatus: QuoteStatus;
        quoteRespondedAt: string;
        quoteCustomerComment: string | null;
      };

      setStatus(json.quoteStatus);
      setRespondedAt(json.quoteRespondedAt);
      setSavedComment(json.quoteCustomerComment);
      toast.success(
        decision === "approved" ? t("approvedToast") : t("declinedToast")
      );
      router.refresh();
    } catch {
      toast.error(t("submitError"));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Card className="space-y-4 border-primary/40 bg-primary/[0.04] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {t("heading")}
          </h2>
        </div>

        <Badge
          variant={
            status === "approved"
              ? "success"
              : status === "declined"
                ? "destructive"
                : "warning"
          }
        >
          {t(`status_${status}`)}
        </Badge>
      </div>

      {quoteRequestedAt ? (
        <p className="text-xs text-muted-foreground">
          {t("requestedAt")}: {formatDate(quoteRequestedAt, locale)}
        </p>
      ) : null}

      {quoteNotes ? (
        <p className="whitespace-pre-line rounded-xl border border-border/70 bg-background/60 p-3.5 text-sm text-foreground">
          {quoteNotes}
        </p>
      ) : null}

      {quoteItems.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-background/50">
          {quoteItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant={item.type === "labor" ? "default" : "violet"}>
                  {item.type === "labor"
                    ? tWo("typeLabor")
                    : tWo("typePart")}
                </Badge>
                <span className="font-medium text-foreground">
                  {item.description}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unitPrice, locale, currency)}
                </span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(item.totalPrice, locale, currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-medium text-muted-foreground">
          {t("estimatedTotal")}
        </span>
        <span className="font-mono text-2xl font-extrabold text-foreground">
          {formatCurrency(quoteTotalAmount, locale, currency)}
        </span>
      </div>

      {status === "pending" ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="quote-comment" className="text-xs">
              {t("commentLabel")}
            </Label>
            <Textarea
              id="quote-comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("commentPlaceholder")}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting !== null}
              onClick={() => void handleDecision("declined")}
            >
              {submitting === "declined" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {t("declineBtn")}
            </Button>
            <Button
              type="button"
              variant="gradient"
              disabled={submitting !== null}
              onClick={() => void handleDecision("approved")}
            >
              {submitting === "approved" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {t("approveBtn")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 text-xs text-muted-foreground">
          {respondedAt ? (
            <p>
              {t("respondedAt")}: {formatDate(respondedAt, locale)}
            </p>
          ) : null}
          {savedComment ? (
            <p className="mt-1 text-foreground">
              {t("yourComment")}: &ldquo;{savedComment}&rdquo;
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

