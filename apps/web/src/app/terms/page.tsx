import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { Footer } from "@/features/landing/components/Footer";

export default function TermsPage() {
  return (
    <MarketingBackground>
      <Navbar />
      <main id="main" tabIndex={-1} className="container flex flex-col gap-4 py-20 outline-none">
        <h1 className="text-3xl font-semibold">Terms of Service</h1>
        <p className="max-w-2xl text-muted-foreground">
          By creating a PacketPulse account you agree to use the platform respectfully, keep your account credentials
          secure, and follow the community's guidelines when posting resources, blogs, or forum replies. A full,
          formal terms document is in progress — for questions in the meantime, reach out at{" "}
          <a href="mailto:packetpulse25@gmail.com" className="text-primary-text underline underline-offset-2 hover:no-underline">
            packetpulse25@gmail.com
          </a>
          .
        </p>
      </main>
      <Footer />
    </MarketingBackground>
  );
}
