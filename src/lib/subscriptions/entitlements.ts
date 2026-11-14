import { NextResponse } from "next/server";
import type { Garage, UserProfile } from "@/types/domain";

/**
 * Checks whether a car owner / driver account currently has an active Pro entitlement.
 */
export function isDriverPro(
  profile: Pick<UserProfile, "plan"> | null | undefined
): boolean {
  return profile?.plan === "pro";
}

/**
 * Checks whether a garage workspace currently has an active Garage Pro entitlement.
 */
export function isGaragePro(
  garage: Pick<Garage, "plan"> | null | undefined
): boolean {
  return garage?.plan === "pro";
}

/**
 * Standardized 402 Payment Required API payload for Pro-only endpoints.
 */
export function buildProRequiredResponse(
  upgradePath: "/app/subscription" | "/garage/subscription",
  requiredPlan: "driver_pro" | "garage_pro"
): NextResponse {
  return NextResponse.json(
    {
      error: "PRO_PLAN_REQUIRED",
      requiredPlan,
      upgradePath,
    },
    { status: 402 }
  );
}

