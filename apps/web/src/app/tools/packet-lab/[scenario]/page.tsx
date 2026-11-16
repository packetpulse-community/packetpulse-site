import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SCENARIOS } from "@packetpulse/netsim";
import { PacketLab } from "@/features/packet-lab/components/PacketLab";

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ scenario: s.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ scenario: string }> }): Promise<Metadata> {
  const { scenario } = await params;
  const s = SCENARIOS.find((x) => x.id === scenario);
  return s
    ? { title: `${s.title} | Packet Lab | PacketPulse`, description: s.summary }
    : { title: "Packet Lab | PacketPulse" };
}

export default async function PacketLabScenarioPage({ params }: { params: Promise<{ scenario: string }> }) {
  const { scenario } = await params;
  if (!SCENARIOS.some((s) => s.id === scenario)) notFound();
  return <PacketLab initialScenario={scenario} />;
}
