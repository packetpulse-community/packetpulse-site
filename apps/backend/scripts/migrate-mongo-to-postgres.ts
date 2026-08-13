// One-off Mongo -> Postgres data migration (plan §9, Phase 7). Run manually once,
// not ongoing dual-write tooling — consistent with the full-rewrite (not strangler)
// approach. Connects to the old Mongo cluster read-only and writes into the new
// Prisma schema in FK-dependency order: users -> content -> child/join tables.
//
// Usage:
//   MONGODB_URI=... DATABASE_URL=... pnpm --filter @packetpulse/backend migrate:mongo -- --dry-run
//   MONGODB_URI=... DATABASE_URL=... pnpm --filter @packetpulse/backend migrate:mongo
//
// --dry-run reads Mongo and logs planned writes without touching Postgres.

import { MongoClient, type Document } from "mongodb";
import { PrismaClient, ProfessionalExperience, BlogCategory, ResourceCategory, ResourceType, RecordingCategory } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error("MONGODB_URI is required");
}

const prisma = new PrismaClient();

// Old app had no schema validation on these free-text fields, so the mapping tables
// below are derived from the actual distinct values found in production data
// (checked via a one-off introspection script before writing this), not guesses.
// Unmapped/unexpected values fall back to "general" rather than throwing, since a
// migration run shouldn't abort on a single bad row — see MIGRATION_WARNINGS.

const CATEGORY_MAP: Record<string, BlogCategory & ResourceCategory & RecordingCategory> = {
  "ccna": "ccna",
  "ccnp": "ccnp",
  "ipv6": "ipv6",
  "network automation": "network_automation",
  "network design": "general",
  "network security": "security",
  "security": "security",
  "sdn": "sdn",
  "troubleshooting": "general",
  "networking basics": "general",
  "tutorial": "general",
};

const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  "article": "article",
  "external link": "external_link",
  "pdf": "pdf",
  "tool": "tool",
  "video": "video",
};

const EXPERIENCE_MAP: Record<string, ProfessionalExperience> = {
  "student": "student",
  "1 year": "junior",
  "2 years": "junior",
  "3+ years": "mid",
};

const MIGRATION_WARNINGS: string[] = [];

function mapCategory(raw: string | undefined): BlogCategory & ResourceCategory & RecordingCategory {
  const key = (raw ?? "").trim().toLowerCase();
  const mapped = CATEGORY_MAP[key];
  if (!mapped) {
    MIGRATION_WARNINGS.push(`Unmapped category "${raw}" -> defaulted to "general"`);
    return "general" as BlogCategory & ResourceCategory & RecordingCategory;
  }
  return mapped;
}

function mapResourceType(raw: string | undefined): ResourceType {
  const key = (raw ?? "").trim().toLowerCase();
  const mapped = RESOURCE_TYPE_MAP[key];
  if (!mapped) {
    MIGRATION_WARNINGS.push(`Unmapped resourceType "${raw}" -> defaulted to "article"`);
    return "article";
  }
  return mapped;
}

function mapExperience(raw: string | undefined): ProfessionalExperience | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const mapped = EXPERIENCE_MAP[key];
  if (!mapped) {
    MIGRATION_WARNINGS.push(`Unmapped professionalExperience "${raw}" -> left null`);
    return null;
  }
  return mapped;
}

function oid(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

async function main() {
  const mongoClient = new MongoClient(mongoUri!);
  await mongoClient.connect();
  const db = mongoClient.db("test");

  console.log(DRY_RUN ? "=== DRY RUN (no Postgres writes) ===" : "=== LIVE RUN ===");

  // --- 1. Roles lookup (seeded by prisma/seed.ts before this script ever runs) ---
  const memberRole = await prisma.role.findUniqueOrThrow({ where: { name: "member" } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });

  // --- 2. Users (root of the FK graph — everything else references userId) ---
  const userIdMap = new Map<string, string>(); // old ObjectId string -> new UUID
  const mongoUsers = await db.collection("users").find().toArray();
  console.log(`Migrating ${mongoUsers.length} users...`);

  for (const u of mongoUsers) {
    const oldId = oid(u._id)!;
    if (DRY_RUN) {
      userIdMap.set(oldId, `dry-run-${oldId}`);
      continue;
    }
    const created = await prisma.user.create({
      data: {
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        email: String(u.email).toLowerCase(),
        // bcrypt hashes are cross-compatible — copied as-is, no forced password reset.
        passwordHash: u.password,
        whatsappNumber: u.whatsappNumber ?? null,
        professionalExperience: mapExperience(u.professionalExperience),
        avatarUrl: u.avatar ?? null,
        isApproved: Boolean(u.isApproved),
        approvedAt: u.approvedAt ? new Date(u.approvedAt) : null,
        emailVerified: Boolean(u.emailVerified),
        lastLoginAt: u.lastLogin ? new Date(u.lastLogin) : null,
        createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
        roles: {
          create: [{ roleId: u.role === "admin" ? adminRole.id : memberRole.id }],
        },
      },
    });
    userIdMap.set(oldId, created.id);

    if (Array.isArray(u.certifications)) {
      for (const cert of u.certifications) {
        if (!cert) continue;
        const name = typeof cert === "string" ? cert : cert.name;
        if (!name) continue;
        await prisma.userCertification.create({
          data: {
            userId: created.id,
            name,
            issueDate: cert.issueDate ? new Date(cert.issueDate) : null,
            expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
            verificationUrl: cert.verificationUrl ?? null,
          },
        });
      }
    }
  }

  // approvedBy self-reference — second pass now that every user has a new id.
  if (!DRY_RUN) {
    for (const u of mongoUsers) {
      if (!u.approvedBy) continue;
      const newId = userIdMap.get(oid(u._id)!);
      const approvedById = userIdMap.get(oid(u.approvedBy)!);
      if (newId && approvedById) {
        await prisma.user.update({ where: { id: newId }, data: { approvedById } });
      }
    }
  }

  function mustMapUser(oldUserId: string | null, context: string): string | null {
    if (!oldUserId) return null;
    const mapped = userIdMap.get(oldUserId);
    if (!mapped) {
      MIGRATION_WARNINGS.push(`${context}: referenced user ${oldUserId} not found — skipped`);
      return null;
    }
    return mapped;
  }

  // --- 3. Blog posts ---
  const mongoBlogs = await db.collection("blogposts").find().toArray();
  console.log(`Migrating ${mongoBlogs.length} blog posts...`);
  for (const b of mongoBlogs) {
    const authorId = mustMapUser(oid(b.author), `blogpost ${oid(b._id)}`);
    if (!authorId) continue;
    if (DRY_RUN) continue;

    const created = await prisma.blogPost.create({
      data: {
        title: b.title,
        slug: b.slug ?? `${oid(b._id)}`,
        content: b.content ?? "",
        authorId,
        coverImageUrl: b.coverImage ?? null,
        category: mapCategory(b.category),
        viewCount: b.viewCount ?? 0,
        isPublished: b.isPublished ?? true,
        postedAt: b.postedDate ? new Date(b.postedDate) : new Date(),
        createdAt: b.createdAt ? new Date(b.createdAt) : undefined,
        updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
        tags: { create: (b.tags ?? []).map((tag: string) => ({ tag })) },
        images: { create: (b.attachedImages ?? []).map((url: string, position: number) => ({ url, position })) },
      },
    });

    for (const likeUserOldId of b.likes ?? []) {
      const likeUserId = mustMapUser(oid(likeUserOldId), `blogpost ${oid(b._id)} like`);
      if (!likeUserId) continue;
      await prisma.blogLike.create({ data: { blogPostId: created.id, userId: likeUserId, createdAt: created.createdAt } }).catch(() => {
        MIGRATION_WARNINGS.push(`blogpost ${oid(b._id)}: duplicate like from user ${likeUserOldId} — skipped`);
      });
    }

    for (const comment of b.comments ?? []) {
      const commentUserId = mustMapUser(oid(comment.user ?? comment.author), `blogpost ${oid(b._id)} comment`);
      if (!commentUserId || !comment.content) continue;
      await prisma.blogComment.create({
        data: {
          blogPostId: created.id,
          userId: commentUserId,
          content: comment.content,
          createdAt: comment.createdAt ? new Date(comment.createdAt) : created.createdAt,
        },
      });
    }
  }

  // --- 4. Resources ---
  const mongoResources = await db.collection("resources").find().toArray();
  console.log(`Migrating ${mongoResources.length} resources...`);
  for (const r of mongoResources) {
    const userId = mustMapUser(oid(r.user), `resource ${oid(r._id)}`);
    if (!userId) continue;
    if (DRY_RUN) continue;

    const created = await prisma.resource.create({
      data: {
        title: r.title,
        description: r.description ?? "",
        resourceType: mapResourceType(r.resourceType),
        category: mapCategory(r.category),
        fileUrl: r.fileUrl ?? null,
        externalLink: r.externalLink ?? null,
        thumbnailUrl: r.thumbnailUrl ?? null,
        downloadable: r.downloadable ?? true,
        premium: r.premium ?? false,
        userId,
        downloads: r.downloads ?? 0,
        views: r.views ?? 0,
        isFeatured: r.isFeatured ?? false,
        isApproved: r.isApproved ?? true,
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
        tags: { create: (r.tags ?? []).map((tag: string) => ({ tag })) },
      },
    });

    for (const likeUserOldId of r.likes ?? []) {
      const likeUserId = mustMapUser(oid(likeUserOldId), `resource ${oid(r._id)} like`);
      if (!likeUserId) continue;
      await prisma.resourceLike
        .create({ data: { resourceId: created.id, userId: likeUserId, createdAt: created.createdAt } })
        .catch(() => MIGRATION_WARNINGS.push(`resource ${oid(r._id)}: duplicate like from user ${likeUserOldId} — skipped`));
    }
  }

  // --- 5. Recordings ---
  const mongoRecordings = await db.collection("recordings").find().toArray();
  console.log(`Migrating ${mongoRecordings.length} recordings...`);
  for (const rec of mongoRecordings) {
    const instructorId = mustMapUser(oid(rec.instructor), `recording ${oid(rec._id)}`);
    if (!instructorId) continue;
    if (DRY_RUN) continue;

    const created = await prisma.recording.create({
      data: {
        title: rec.title,
        description: rec.description ?? "",
        recordingUrl: rec.recordingUrl,
        thumbnailUrl: rec.thumbnailUrl ?? null,
        durationSeconds: rec.duration ?? 0,
        category: mapCategory(rec.category),
        instructorId,
        premium: rec.premium ?? false,
        isFeatured: rec.isFeatured ?? true,
        isApproved: rec.isApproved ?? true,
        views: rec.views ?? 0,
        recordedAt: rec.recordedAt ? new Date(rec.recordedAt) : new Date(),
        createdAt: rec.createdAt ? new Date(rec.createdAt) : undefined,
        updatedAt: rec.updatedAt ? new Date(rec.updatedAt) : undefined,
        tags: { create: (rec.tags ?? []).map((tag: string) => ({ tag })) },
      },
    });

    for (const participantOldId of rec.participants ?? []) {
      const participantId = mustMapUser(oid(participantOldId), `recording ${oid(rec._id)} participant`);
      if (!participantId) continue;
      await prisma.recordingParticipant
        .create({ data: { recordingId: created.id, userId: participantId, joinedAt: created.recordedAt } })
        .catch(() => MIGRATION_WARNINGS.push(`recording ${oid(rec._id)}: duplicate participant ${participantOldId} — skipped`));
    }

    for (const likeUserOldId of rec.likes ?? []) {
      const likeUserId = mustMapUser(oid(likeUserOldId), `recording ${oid(rec._id)} like`);
      if (!likeUserId) continue;
      await prisma.recordingLike
        .create({ data: { recordingId: created.id, userId: likeUserId, createdAt: created.createdAt } })
        .catch(() => MIGRATION_WARNINGS.push(`recording ${oid(rec._id)}: duplicate like from user ${likeUserOldId} — skipped`));
    }
  }

  // --- 6. Forum posts — old collection exists but is empty in production; nothing to migrate. ---
  const forumCount = await db.collection("forumposts").countDocuments();
  if (forumCount > 0) {
    MIGRATION_WARNINGS.push(`forumposts collection has ${forumCount} docs but no migration path is implemented for it (was empty when this script was written) — investigate before relying on this script as-is`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Users:      ${mongoUsers.length}`);
  console.log(`Blog posts: ${mongoBlogs.length}`);
  console.log(`Resources:  ${mongoResources.length}`);
  console.log(`Recordings: ${mongoRecordings.length}`);
  if (MIGRATION_WARNINGS.length > 0) {
    console.log(`\n=== ${MIGRATION_WARNINGS.length} warning(s) ===`);
    for (const w of MIGRATION_WARNINGS) console.log(`- ${w}`);
  }

  await mongoClient.close();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
