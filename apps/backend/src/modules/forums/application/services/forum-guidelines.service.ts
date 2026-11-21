import { ForbiddenException, Injectable } from "@nestjs/common";
import { ForumGuidelinesStatus, ForumGuidelinesView, PublishForumGuidelinesDto } from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "../../../admin";

// Community guidelines (PRD-054, DB-030): versioned text an admin edits; a member accepts before
// the first post. Decision: acceptance is a record of its own (version and time), not a consent
// purpose, because ConsentPurpose is a privacy-consent enum owned by the consent module. A new
// version does not force a second acceptance; the page shows what changed and the compose box
// always links the current text.
@Injectable()
export class ForumGuidelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminActivityLogService,
  ) {}

  async current(): Promise<ForumGuidelinesView> {
    const row = await this.prisma.forumGuidelineVersion.findFirstOrThrow({ orderBy: { version: "desc" } });
    return { version: row.version, body: row.body, publishedAt: row.createdAt.toISOString() };
  }

  async status(userId: string): Promise<ForumGuidelinesStatus> {
    const [current, accepted] = await Promise.all([
      this.current(),
      this.prisma.forumGuidelineAcceptance.findFirst({ where: { userId }, orderBy: { version: "desc" } }),
    ]);
    return {
      current,
      acceptedVersion: accepted?.version ?? null,
      acceptedAt: accepted?.acceptedAt.toISOString() ?? null,
      mustAccept: !accepted,
    };
  }

  /** Records the acceptance of the current version (repeat calls change nothing). */
  async accept(userId: string): Promise<ForumGuidelinesStatus> {
    const current = await this.current();
    await this.prisma.forumGuidelineAcceptance.upsert({
      where: { userId_version: { userId, version: current.version } },
      create: { userId, version: current.version },
      update: {},
    });
    return this.status(userId);
  }

  async assertAccepted(userId: string) {
    const accepted = await this.prisma.forumGuidelineAcceptance.findFirst({ where: { userId }, select: { version: true } });
    if (!accepted) {
      throw new ForbiddenException("Read and accept the community guidelines before your first post.");
    }
  }

  async publish(actorId: string, dto: PublishForumGuidelinesDto): Promise<ForumGuidelinesView> {
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.forumGuidelineVersion.findFirstOrThrow({ orderBy: { version: "desc" } });
      const row = await tx.forumGuidelineVersion.create({
        data: { version: latest.version + 1, body: dto.body, createdById: actorId },
      });
      await this.audit.log(
        actorId,
        "forum_guidelines_published",
        "forum_guidelines",
        row.id,
        { version: row.version, previousVersion: latest.version },
        dto.reason,
        tx,
      );
      return { version: row.version, body: row.body, publishedAt: row.createdAt.toISOString() };
    });
  }
}
