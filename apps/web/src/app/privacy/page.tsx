import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { Footer } from "@/features/landing/components/Footer";

export default function PrivacyPage() {
  return (
    <MarketingBackground>
      <Navbar />
      <main className="container flex flex-col gap-4 py-20">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="max-w-2xl text-muted-foreground">
          PacketPulse stores only what's needed to run your account — your name, email, and the content you choose
          to publish. We don't sell your data. A full, formal privacy policy is in progress — for questions in the
          meantime, reach out at{" "}
          <a href="mailto:packetpulse25@gmail.com" className="text-brand hover:underline">
            packetpulse25@gmail.com
          </a>
          .
        </p>
      </main>
      <Footer />
    </MarketingBackground>
  );
}
