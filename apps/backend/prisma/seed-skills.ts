import { PrismaClient, SkillLevel } from "@prisma/client";

// TASK-027 starter taxonomy: networking, security and cloud basics (Major > Minor > Micro).
// Idempotent and non-destructive: a skill is only created when its name is not taken, so an
// admin's renames, retirements and extra aliases are never undone by re-running the seed.
// The key helpers mirror src/modules/skills/domain/skill-keys.ts (kept inline so the seed
// has no dependency on application code).

const nameKeyOf = (n: string) => n.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const matchKeyOf = (n: string) => nameKeyOf(n).replace(/[^\p{L}\p{N}]/gu, "");

type Micro = string | { name: string; aliases: string[] };
type Minor = { name: string; micro: Micro[] };
type Major = { name: string; description: string; minor: Minor[] };

export const STARTER_TAXONOMY: Major[] = [
  {
    name: "Networking",
    description: "Designing, building and operating IP networks.",
    minor: [
      {
        name: "Routing",
        micro: [
          { name: "OSPF", aliases: ["Open Shortest Path First"] },
          { name: "EIGRP", aliases: ["Enhanced Interior Gateway Routing Protocol"] },
          { name: "BGP", aliases: ["Border Gateway Protocol"] },
          { name: "Static routing", aliases: ["Static routes"] },
          "Route redistribution",
        ],
      },
      {
        name: "Switching",
        micro: [
          { name: "VLANs", aliases: ["VLAN", "Virtual LANs"] },
          { name: "Spanning Tree", aliases: ["STP", "Spanning Tree Protocol"] },
          { name: "EtherChannel", aliases: ["Link aggregation", "LACP"] },
          "Inter-VLAN routing",
        ],
      },
      {
        name: "IP addressing",
        micro: [{ name: "IPv4 subnetting", aliases: ["Subnetting", "VLSM"] }, { name: "IPv6", aliases: ["IP version 6"] }],
      },
      {
        name: "Network services",
        micro: [
          { name: "DNS", aliases: ["Domain Name System"] },
          { name: "DHCP", aliases: ["Dynamic Host Configuration Protocol"] },
          { name: "NAT", aliases: ["Network Address Translation", "PAT"] },
          { name: "NTP", aliases: ["Network Time Protocol"] },
        ],
      },
      {
        name: "Network automation",
        micro: ["Python for networking", { name: "Ansible", aliases: ["Ansible for networking"] }, { name: "REST APIs and NETCONF", aliases: ["NETCONF", "RESTCONF"] }],
      },
    ],
  },
  {
    name: "Security",
    description: "Protecting networks, systems and data.",
    minor: [
      {
        name: "Network security",
        micro: [
          { name: "Firewalls", aliases: ["Firewall"] },
          { name: "Access control lists", aliases: ["ACLs", "ACL"] },
          { name: "VPN and IPsec", aliases: ["IPsec", "Site-to-site VPN"] },
          { name: "IDS and IPS", aliases: ["Intrusion detection", "Intrusion prevention"] },
        ],
      },
      {
        name: "Identity and access",
        micro: [
          { name: "AAA", aliases: ["Authentication, authorization and accounting"] },
          { name: "Multi-factor authentication", aliases: ["MFA", "2FA"] },
          { name: "Role-based access control", aliases: ["RBAC"] },
        ],
      },
      {
        name: "Security operations",
        micro: [
          { name: "SIEM", aliases: ["Security information and event management"] },
          "Incident response",
          "Vulnerability management",
        ],
      },
      {
        name: "Cryptography basics",
        micro: [{ name: "TLS and certificates", aliases: ["TLS", "SSL", "PKI"] }, "Hashing and encryption"],
      },
    ],
  },
  {
    name: "Cloud",
    description: "Building and running workloads on public cloud platforms.",
    minor: [
      {
        name: "Cloud fundamentals",
        micro: ["Shared responsibility model", { name: "IaaS, PaaS and SaaS", aliases: ["Cloud service models"] }, "Cloud cost basics"],
      },
      {
        name: "Cloud networking",
        micro: [
          { name: "VPC and virtual networks", aliases: ["VPC", "VNet"] },
          { name: "Cloud load balancing", aliases: ["Load balancers"] },
          { name: "Cloud VPN and interconnect", aliases: ["Direct Connect", "ExpressRoute"] },
        ],
      },
      {
        name: "Cloud security",
        micro: [{ name: "Cloud IAM", aliases: ["IAM"] }, "Security groups and network ACLs", "Secrets and key management"],
      },
      {
        name: "Containers and infrastructure as code",
        micro: ["Docker basics", "Kubernetes basics", { name: "Terraform", aliases: ["Infrastructure as code"] }],
      },
    ],
  },
];

export async function seedSkills(prisma: PrismaClient) {
  await prisma.skillTaxonomyState.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  let created = 0;
  const ensure = async (name: string, level: SkillLevel, parentId: string | null, position: number, description?: string, aliases: string[] = []) => {
    const nameKey = nameKeyOf(name);
    const existing = await prisma.skill.findUnique({ where: { nameKey } });
    if (existing) return existing.id;
    created++;
    const skill = await prisma.skill.create({ data: { name, nameKey, matchKey: matchKeyOf(name), level, parentId, position, description } });
    for (const alias of aliases) {
      const aliasKey = nameKeyOf(alias);
      const taken = (await prisma.skill.findUnique({ where: { nameKey: aliasKey } })) ?? (await prisma.skillAlias.findUnique({ where: { aliasKey } }));
      if (!taken) await prisma.skillAlias.create({ data: { skillId: skill.id, alias, aliasKey, matchKey: matchKeyOf(alias) } });
    }
    return skill.id;
  };

  for (const [i, major] of STARTER_TAXONOMY.entries()) {
    const majorId = await ensure(major.name, "major", null, i, major.description);
    for (const [j, minor] of major.minor.entries()) {
      const minorId = await ensure(minor.name, "minor", majorId, j);
      for (const [k, micro] of minor.micro.entries()) {
        const m = typeof micro === "string" ? { name: micro, aliases: [] } : micro;
        await ensure(m.name, "micro", minorId, k, undefined, m.aliases);
      }
    }
  }
  return created;
}
