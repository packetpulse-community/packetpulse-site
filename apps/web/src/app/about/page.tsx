import type { Metadata } from "next";
import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { AboutHero } from "@/features/landing/components/AboutHero";
import { AboutStats } from "@/features/landing/components/AboutStats";
import { AboutMission } from "@/features/landing/components/AboutMission";
import { AboutOffer } from "@/features/landing/components/AboutOffer";
import { AboutTeam } from "@/features/landing/components/AboutTeam";
import { FinalCta } from "@/features/landing/components/FinalCta";
import { Footer } from "@/features/landing/components/Footer";

export const metadata: Metadata = {
  title: "About | PacketPulse",
  description: "Empowering network engineers through community, knowledge sharing, and professional growth.",
};

export default function AboutPage() {
  return (
    <MarketingBackground>
      <Navbar />
      <main>
        <AboutHero />
        <AboutStats />
        <AboutMission />
        <AboutOffer />
        <AboutTeam />
        <FinalCta />
      </main>
      <Footer />
    </MarketingBackground>
  );
}
