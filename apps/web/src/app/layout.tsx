import type { Metadata } from "next";
import { QueryProvider } from "@/shared/providers/QueryProvider";
import { TooltipProvider } from "@/shared/ui/primitives/Tooltip";
import { GlobalErrorLogger } from "@/shared/components/GlobalErrorLogger";
import { MotionProvider } from "@/shared/components/MotionProvider";
import { SkipLink } from "@/shared/components/SkipLink";
import "@/shared/styles/globals.css";
import "@/shared/styles/motion.css";

export const metadata: Metadata = {
  title: "PacketPulse",
  description: "Community platform for networking professionals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body>
        <SkipLink />
        <QueryProvider>
          <GlobalErrorLogger />
          <MotionProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </MotionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
