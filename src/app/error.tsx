"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("[Veltrox Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("boundaryTitle")}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("boundaryDesc")}
      </p>
      <Button variant="gradient" className="mt-6" onClick={() => reset()}>
        <RotateCcw className="h-4 w-4" />
        {t("tryAgain")}
      </Button>
    </div>
  );
}

