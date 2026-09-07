import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/shared/providers/QueryProvider";
import { TooltipProvider } from "@/shared/ui/primitives/Tooltip";
import { GlobalErrorLogger } from "@/shared/components/GlobalErrorLogger";
import "@/shared/styles/globals.css";

// The reference project has no custom font (runs on the system-default stack) —
// Inter is an additive choice on top of the design-system port, picked to fit the
// indigo/purple/cyan SaaS aesthetic without adding runtime cost (next/font self-hosts).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PacketPulse",
  description: "Community platform for networking professionals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} data-scroll-behavior="smooth">
      <body>
        <QueryProvider>
          <GlobalErrorLogger />
          <TooltipProvider>{children}</TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
