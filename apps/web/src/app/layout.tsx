import type { Metadata } from "next";
import { QueryProvider } from "@/shared/providers/QueryProvider";
import "@/shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PacketPulse",
  description: "Community platform for networking professionals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
