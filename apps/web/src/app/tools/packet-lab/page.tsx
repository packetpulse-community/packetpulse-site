import type { Metadata } from "next";
import { PacketLab } from "@/features/packet-lab/components/PacketLab";

export const metadata: Metadata = {
  title: "Packet Lab | PacketPulse",
  description: "Watch a network work, packet by packet: DNS, ARP, routing, TCP and HTTP, with every header and byte open to inspect.",
};

export default function PacketLabPage() {
  return <PacketLab initialScenario="web-page" />;
}
