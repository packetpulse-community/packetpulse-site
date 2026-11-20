import type { Metadata } from "next";
import { QueryProvider } from "@/shared/providers/QueryProvider";
import { TooltipProvider } from "@/shared/ui/primitives/Tooltip";
import { GlobalErrorLogger } from "@/shared/components/GlobalErrorLogger";
import { MotionProvider } from "@/shared/components/MotionProvider";
import { SkipLink } from "@/shared/components/SkipLink";
import { THEME_INIT_SCRIPT } from "@/shared/theme/theme";
import { LegacyScope } from "@/shared/theme/LegacyScope";
import "@/shared/styles/globals.css";
import "@/shared/styles/motion.css";

export const metadata: Metadata = {
  title: "PacketPulse",
  description: "Community platform for networking professionals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Light is the default. The inline script applies the saved Light/Dark/System choice to <html>
    // before first paint (no flash), so the class it sets is not React's to reconcile.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SkipLink />
        <QueryProvider>
          <GlobalErrorLogger />
          <MotionProvider>
            <TooltipProvider>
                {/* Legacy page-scope screens render dark until their route group is migrated. */}
                <LegacyScope kind="page">{children}</LegacyScope>
              </TooltipProvider>
          </MotionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
