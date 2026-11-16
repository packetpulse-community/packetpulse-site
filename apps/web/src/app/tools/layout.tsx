import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { Footer } from "@/features/landing/components/Footer";

// Public Tools area: usable without an account, so it also works as a front door to the community.
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingBackground>
      <Navbar />
      <main id="main" className="container flex-1 py-8">
        {children}
      </main>
      <Footer />
    </MarketingBackground>
  );
}
