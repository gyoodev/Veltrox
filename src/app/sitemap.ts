import type { MetadataRoute } from "next";
import { getApprovedGarages } from "@/lib/data/user-diary";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const lastModified = new Date();

  const publicRoutes = [
    "",
    "/garages",
    "/login",
    "/register",
    "/privacy",
    "/terms",
  ];

  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified,
    changeFrequency: route === "" || route === "/garages" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/garages" ? 0.9 : 0.7,
  }));

  try {
    const garages = await getApprovedGarages();
    const garageEntries: MetadataRoute.Sitemap = garages.map((garage) => ({
      url: `${appUrl}/garages/${garage.slug}`,
      lastModified: garage.updatedAt ? new Date(garage.updatedAt) : lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...staticEntries, ...garageEntries];
  } catch {
    return staticEntries;
  }
}
