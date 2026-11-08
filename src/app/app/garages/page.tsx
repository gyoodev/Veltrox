import { getTranslations } from "next-intl/server";
import { GarageDirectoryClient } from "@/components/car-diary/garage-directory-client";
import { requireRole } from "@/lib/auth/server-auth";
import { getApprovedGarages, getUserDiaryBundle } from "@/lib/data/user-diary";

export default async function AppGaragesDirectoryPage() {
  const { profile } = await requireRole(["USER", "ADMIN"]);
  const [garages, bundle, t] = await Promise.all([
    getApprovedGarages(),
    getUserDiaryBundle(profile.uid),
    getTranslations("carDiary.garagesDir"),
  ]);

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

      <GarageDirectoryClient
        garages={garages}
        userVehicles={bundle.vehicles}
        userProfile={profile}
      />
    </div>
  );
}

