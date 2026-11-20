import { isIP } from "node:net";

export type TrustProxySetting = boolean | number | string[];

const KEYWORDS = new Set(["loopback", "linklocal", "uniquelocal"]);

function isAddressOrCidr(entry: string): boolean {
  if (KEYWORDS.has(entry)) return true;
  const [addr, prefix, ...rest] = entry.split("/");
  const version = isIP(addr);
  if (rest.length > 0 || version === 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;
  return Number(prefix) <= (version === 4 ? 32 : 128);
}

/**
 * Parses TRUST_PROXY (finding S-11) into the value Express's "trust proxy" setting takes.
 * Accepts: unset/empty (= true, the historical default), "true", "false", a non-negative
 * integer hop count, or a comma-separated list of IPs / CIDRs (or Express's loopback,
 * linklocal, uniquelocal). Anything else throws, so a typo fails the boot instead of
 * silently trusting everything.
 */
export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = (raw ?? "").trim();
  if (value === "") return true;
  const lower = value.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (!Number.isSafeInteger(hops)) throw new Error(`Invalid TRUST_PROXY "${raw}": hop count too large`);
    return hops;
  }
  const entries = value.split(",").map((e) => e.trim());
  if (entries.some((e) => e === "" || !isAddressOrCidr(e))) {
    throw new Error(
      `Invalid TRUST_PROXY "${raw}": use true, false, a hop count like 2, or a comma-separated list of IPs/CIDRs`,
    );
  }
  return entries;
}
