import type { Metadata } from "next";
import { DesignSystemView } from "@/features/design-system/DesignSystemView";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <DesignSystemView />;
}
