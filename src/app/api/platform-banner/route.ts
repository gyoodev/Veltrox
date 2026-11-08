import { NextResponse } from "next/server";
import { getPublicPlatformCms } from "@/lib/data/platform-cms";

export async function GET(): Promise<NextResponse> {
  const cms = await getPublicPlatformCms();
  return NextResponse.json({ banner: cms.banner });
}

