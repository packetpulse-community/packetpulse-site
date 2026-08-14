import { cookies } from "next/headers";
import { resourcesServerApi, type ResourceSummary } from "@/features/resources/api/resources.api";
import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { Hero } from "@/features/landing/components/Hero";
import { StatsStrip } from "@/features/landing/components/StatsStrip";
import { WhatWeOffer } from "@/features/landing/components/WhatWeOffer";
import { LatestResources } from "@/features/landing/components/LatestResources";
import { NetworkCta } from "@/features/landing/components/NetworkCta";
import { TestimonialsCarousel } from "@/features/landing/components/TestimonialsCarousel";
import { CommunityValues } from "@/features/landing/components/CommunityValues";
import { Faq } from "@/features/landing/components/Faq";
import { FinalCta } from "@/features/landing/components/FinalCta";
import { Footer } from "@/features/landing/components/Footer";

async function getLatestResources(cookieHeader: string): Promise<ResourceSummary[]> {
  try {
    const { data } = await resourcesServerApi.list(cookieHeader, "?limit=3");
    return data;
  } catch {
    // Public marketing page shouldn't hard-fail if the backend is briefly unreachable.
    return [];
  }
}

export default async function LandingPage() {
  const cookieHeader = (await cookies()).toString();
  const latestResources = await getLatestResources(cookieHeader);

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
        <CommunityValues />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </MarketingBackground>
  );
}
