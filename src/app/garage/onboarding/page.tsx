import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/garage/onboarding-wizard";
import { requireApprovedGarage } from "@/lib/auth/server-auth";

export default async function GarageOnboardingPage() {
  const { profile } = await requireApprovedGarage();
  if (profile.garageId) {
    redirect("/garage");
  }

  return <OnboardingWizard profile={profile} />;
}

