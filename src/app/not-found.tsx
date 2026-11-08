import { Compass } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFoundPage() {
  const t = await getTranslations("errors");
  const tCommon = await getTranslations("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
        <Compass className="h-8 w-8" />
      </div>
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("notFoundDesc")}
      </p>
      <Button asChild variant="gradient" className="mt-6">
        <Link href="/">{tCommon("backHome")}</Link>
      </Button>
    </div>
  );
}

