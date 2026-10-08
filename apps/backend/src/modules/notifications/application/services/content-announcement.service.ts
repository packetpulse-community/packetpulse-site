import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../../prisma/prisma.service";
import { EmailQueueService } from "./email-queue.service";
import { frontendUrl } from "../../../../common/config/frontend-url";

export interface AnnouncedContent {
  kind: "blog" | "resource";
  id: string;
  title: string;
  // Blogs are addressed by slug on the frontend, resources by id.
  path: string;
  authorId: string;
}

// Emails every active member (admin-approved + email-verified) when an admin
// publishes a blog or resource — either by creating it directly or by approving a
// member's submission. One queued job per recipient: a failed address retries on
// its own without re-sending to everyone else.
@Injectable()
export class ContentAnnouncementService {
  private readonly logger = new Logger(ContentAnnouncementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
  ) {}

  // Never throws — the content is already published by the time this runs, and a
  // queue/Redis hiccup must not turn a successful publish into a 500.
  async announce(content: AnnouncedContent) {
    try {
      const recipients = await this.prisma.user.findMany({
        where: { isApproved: true, emailVerified: true, id: { not: content.authorId } },
        select: { email: true },
      });
      if (recipients.length === 0) return;

      const link = `${frontendUrl(this.config)}${content.path}`;
      await this.emailQueue.sendNewContentEmails(
        recipients.map((r) => r.email),
        { kind: content.kind, title: content.title, link },
      );
      this.logger.log(`Announced ${content.kind} "${content.title}" to ${recipients.length} member(s)`);
    } catch (err) {
      this.logger.error(`Failed to announce ${content.kind} ${content.id}`, err as Error);
    }
  }
}
