// Contrast pairs for the Packet Lab protocol hues (names are CSS variables from grove-tokens.css
// and packet-lab.css). Checked in both modes by packet-lab-contrast.test.ts.
export const PROTOCOLS = ["eth", "arp", "ip", "icmp", "udp", "tcp", "dns", "http"] as const;

export interface PlPair {
  name: string;
  fg: string;
  bg: string;
}

export const PL_PAIRS: PlPair[] = PROTOCOLS.flatMap((p) => [
  { name: `${p} text on its soft fill`, fg: `--pl-${p}`, bg: `--pl-${p}-soft` },
  { name: `${p} text/stroke on surface`, fg: `--pl-${p}`, bg: "--grove-surface" },
  { name: `body text on ${p} soft fill`, fg: "--grove-text", bg: `--pl-${p}-soft` },
  { name: `secondary text on ${p} soft fill`, fg: "--grove-text-secondary", bg: `--pl-${p}-soft` },
]);
