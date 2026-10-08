import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { apiFetch } from "@/shared/api/http-client";
import { resourcesServerApi, type ResourceSummary } from "@/features/resources/api/resources.api";
import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { Hero } from "@/features/landing/components/Hero";
import { StatsStrip } from "@/features/landing/components/StatsStrip";
import { WhatWeOffer } from "@/features/landing/components/WhatWeOffer";
import { LatestResources } from "@/features/landing/components/LatestResources";
import { NetworkCta } from "@/features/landing/components/NetworkCta";
import { TestimonialsCarousel } from "@/features/landing/components/TestimonialsCarousel";
import { UpcomingEvents } from "@/features/landing/components/UpcomingEvents";
import { CommunityValues } from "@/features/landing/components/CommunityValues";
import { Faq } from "@/features/landing/components/Faq";
import { FinalCta } from "@/features/landing/components/FinalCta";
import { Footer } from "@/features/landing/components/Footer";

async function getLatestResources(cookieHeader: string): Promise<ResourceSummary[]> {
  try {
    const { data } = await resourcesServerApi.list(cookieHeader, "?limit=3");
    return data;
  } catch (err) {
    // Let a maintenance redirect through; otherwise the public marketing page
    // shouldn't hard-fail if the backend is briefly unreachable.
    unstable_rethrow(err);
    return [];
  }
}

// The landing page makes no other members-only call that would surface
// maintenance, so it asks explicitly. Admins (canBypass) still see the site.
async function inMaintenance(cookieHeader: string): Promise<boolean> {
  try {
    const status = await apiFetch<{ maintenanceMode: boolean; canBypass: boolean }>("/site-status", { cookieHeader });
    return status.maintenanceMode && !status.canBypass;
  } catch {
    return false;
  }
}

export default async function LandingPage() {
  const cookieHeader = (await cookies()).toString();
  const [maintenance, latestResources] = await Promise.all([
    inMaintenance(cookieHeader),
    getLatestResources(cookieHeader),
  ]);
  if (maintenance) redirect("/maintenance");

  return (
    <MarketingBackground>
      <Navbar />
      <main>
        <Hero />
        <StatsStrip />
        <WhatWeOffer />
        <LatestResources resources={latestResources} />
        <NetworkCta />
        <TestimonialsCarousel />
        <UpcomingEvents />
        <CommunityValues />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </MarketingBackground>
  );
}
