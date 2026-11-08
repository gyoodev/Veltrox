"use client";

import {
  Calendar,
  ExternalLink,
  FileText,
  FolderLock,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DocumentDialog } from "@/components/car-diary/document-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { evaluateDocumentExpiry } from "@/lib/diary-metrics";
import { formatDate } from "@/lib/utils";
import type { AppLocale, Vehicle, VehicleDocument } from "@/types/domain";

interface DocumentsVaultClientProps {
  ownerUid: string;
  initialDocuments: VehicleDocument[];
  vehicles: Vehicle[];
  scopedVehicleId?: string;
  showPageHeader?: boolean;
}

export function DocumentsVaultClient({
  ownerUid,
  initialDocuments,
  vehicles,
  scopedVehicleId,
  showPageHeader = false,
}: DocumentsVaultClientProps) {
  const t = useTranslations("carDiary.documents");
  const tDocTypes = useTranslations("carDiary.docTypes");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [documents, setDocuments] =
    useState<VehicleDocument[]>(initialDocuments);
  const [dialogOpen, setDialogOpen] = useState(false);

  const vehicleMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const handleDelete = async (docId: string) => {
    const prev = documents;
    setDocuments((list) => list.filter((d) => d.id !== docId));

    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (!res.ok) {
      setDocuments(prev);
      toast.error("Delete failed.");
      return;
    }

    toast.success(t("deletedToast"));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {showPageHeader ? (
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("pageSubtitle")}
            </p>
          </div>
        ) : (
          <div />
        )}

        <Button
          variant="gradient"
          disabled={vehicles.length === 0}
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("addDocument")}
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FolderLock}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            vehicles.length > 0 ? (
              <Button variant="gradient" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("addDocument")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {documents.map((doc) => {
            const veh = vehicleMap.get(doc.vehicleId);
            const { state, daysRemaining } = evaluateDocumentExpiry(
              doc.expiryDate
            );

            const statusBadge =
              state === "expired" ? (
                <Badge variant="warning">{t("statusExpired")}</Badge>
              ) : state === "expiring_soon" ? (
                <Badge variant="warning">
                  {t("statusExpiring", { days: daysRemaining ?? 0 })}
                </Badge>
              ) : state === "valid" ? (
                <Badge variant="success">{t("statusValid")}</Badge>
              ) : (
                <Badge variant="secondary">{t("statusNoExpiry")}</Badge>
              );

            return (
              <Card
                key={doc.id}
                hoverLift
                className="flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {statusBadge}
                      <Badge variant="outline">{tDocTypes(doc.docType)}</Badge>
                    </div>
                    {!scopedVehicleId && veh ? (
                      <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                        {veh.plateNumber}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {doc.title}
                      </h3>
                      {doc.expiryDate ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {formatDate(doc.expiryDate, locale)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3.5">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("viewFile")}
                    </a>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    aria-label="Delete document"
                    onClick={() => void handleDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ownerUid={ownerUid}
        vehicles={vehicles}
        defaultVehicleId={scopedVehicleId}
        onSaved={(saved) => {
          setDocuments((prev) => [saved, ...prev]);
          router.refresh();
        }}
      />
    </div>
  );
}

