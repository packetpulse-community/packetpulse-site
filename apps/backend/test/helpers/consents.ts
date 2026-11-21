import type { PrismaService } from "../../src/prisma/prisma.service";

// The consents a registration form would send: the Terms and the Privacy Policy at whatever
// version is current in the database (a consent test may have published a newer one).
export async function acceptedConsents(prisma: PrismaService) {
  const rows = await prisma.consentPolicy.findMany({
    where: { purpose: { in: ["terms", "privacy"] } },
    orderBy: [{ purpose: "asc" }, { version: "desc" }],
    distinct: ["purpose"],
  });
  return rows.map((r) => ({ purpose: r.purpose, policyVersion: r.version }));
}
