import { getTranslations } from "next-intl/server";
import { ExpenseCharts } from "@/components/car-diary/expense-charts";
import { requireRole } from "@/lib/auth/server-auth";
import { getUserDiaryBundle } from "@/lib/data/user-diary";

export default async function ExpensesPage() {
  const { profile } = await requireRole(["USER"]);
  const bundle = await getUserDiaryBundle(profile.uid);
  const t = await getTranslations("carDiary.expenses");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("pageSubtitle")}
        </p>
      </div>

      <ExpenseCharts
        entries={bundle.diaryEntries}
        vehicles={bundle.vehicles}
        showVehicleFilter
      />
    </div>
  );
}

