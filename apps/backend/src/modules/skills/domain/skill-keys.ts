// Name normalisation for the taxonomy (DB-006: "name unique ignoring case").

/** Lower-cased, whitespace-collapsed form used for uniqueness: "OSPF  v2" and "ospf v2" collide. */
export function nameKeyOf(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Letters and digits only: "OSPF v2", "OSPFv2" and "ospf-v2" share it. Drives clear-match detection. */
export function matchKeyOf(name: string): string {
  return nameKeyOf(name).replace(/[^\p{L}\p{N}]/gu, "");
}

export function displayNameOf(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ");
}
