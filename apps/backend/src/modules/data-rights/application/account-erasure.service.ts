import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import { DAY_MS, ERASURE_GRACE_DAYS } from "@packetpulse/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageProvider } from "../../../common/storage/storage-provider";
import { frontendUrl } from "../../../common/config/frontend-url";
import { AdminActivityLogService } from "../../admin/application/services/admin-activity-log.service";
import { CredentialProvider } from "../../identity";
import { EmailQueueService } from "../../notifications";
import { idempotencyJobId } from "../../notifications/infrastructure/queue/queue-config";
import { DATA_RIGHTS_QUEUE, ERASE_RECLAIM_AFTER_MS, JOB_ERASE, DataRightsJob } from "./data-rights.constants";
import { toView } from "./data-request.view";

const OPEN = "open";

// Account deletion in two steps (SCR-038, S-5, D-2): a request with password re-entry that
// deactivates the account for ERASURE_GRACE_DAYS, then the erasure job. What is deleted,
// anonymised or kept is the table ERASURE_RULES in packages/types, documented in
// docs/ops/data-retention.md. The user row is never deleted: it becomes a tombstone with no
// personal data, so other members' threads, certificates and the audit trail keep a valid
// reference (the old cascade deleted whole threads and the audit actor).
@Injectable()
export class AccountErasureService {
  private readonly logger = new Logger(AccountErasureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialProvider,
    private readonly storage: StorageProvider,
    private readonly config: ConfigService,
    private readonly audit: AdminActivityLogService,
    private readonly emails: EmailQueueService,
    @InjectQueue(DATA_RIGHTS_QUEUE) private readonly queue: Queue<DataRightsJob>,
  ) {}

  private pageLink() {
    return `${frontendUrl(this.config)}/settings/data-rights`;
  }

  async latest(userId: string) {
    const row = await this.prisma.dataRequest.findFirst({ where: { userId, kind: "erasure" }, orderBy: { requestedAt: "desc" } });
    return row ? toView(row) : null;
  }

  async request(userId: string, password: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.erasedAt) throw new NotFoundException("User not found");
    try {
      await this.credentials.verifyCredential(user.email, password, user.passwordHash);
    } catch {
      throw new BadRequestException("Password is incorrect");
    }

    const scheduledFor = new Date(now.getTime() + ERASURE_GRACE_DAYS * DAY_MS);
    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.dataRequest.create({
          data: { userId, kind: "erasure", status: "scheduled", activeSlot: OPEN, requestedAt: now, scheduledFor },
        });
        await tx.user.update({ where: { id: userId }, data: { deactivatedAt: now } });
        // Every session ends now; the member signs in again (the account is deactivated, so only
        // the data-rights page works) to cancel. Tokens already issued stop at the next request.
        await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        await this.audit.log(userId, "account_deletion_requested", "user", userId, { requestId: row.id, scheduledFor: scheduledFor.toISOString() }, "Member asked to delete their account", tx);
        return row;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Your account is already scheduled for deletion.");
      }
      throw err;
    }
    await this.notify(user.id, user.email, "deletion-scheduled", scheduledFor, `erase-scheduled-${created.id}`);
    return toView(created);
  }

  // Cancel during the grace period: the account is active again. Refused once the erasure job
  // has started on it.
  async cancel(userId: string, now = new Date()) {
    const row = await this.prisma.dataRequest.findFirst({ where: { userId, kind: "erasure", activeSlot: OPEN } });
    if (!row) throw new NotFoundException("There is no deletion scheduled for your account.");
    const done = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.dataRequest.updateMany({
        where: { id: row.id, status: "scheduled", startedAt: null },
        data: { status: "cancelled", activeSlot: null, cancelledAt: now },
      });
      if (closed.count !== 1) return false;
      await tx.user.update({ where: { id: userId }, data: { deactivatedAt: null } });
      await this.audit.log(userId, "account_deletion_cancelled", "user", userId, { requestId: row.id }, "Member cancelled the deletion", tx);
      return true;
    });
    if (!done) throw new ConflictException("The deletion has already started and can no longer be cancelled.");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user) await this.notify(userId, user.email, "deletion-cancelled", undefined, `erase-cancelled-${row.id}`);
    return { success: true };
  }

  private async notify(userId: string, to: string, kind: "deletion-scheduled" | "deletion-cancelled", date: Date | undefined, key: string) {
    try {
      await this.emails.sendDataRightsNotice(
        to,
        { name: "data-rights-notice", kind, link: this.pageLink(), date: date?.toISOString().slice(0, 10) },
        { userId, type: "account_deletion", key },
      );
    } catch (err) {
      this.logger.warn(`Deletion notice (${kind}) not sent: ${(err as Error).message}`);
    }
  }

  // Staff-initiated erasure (admin "delete user"): same erasure, no grace period and no password.
  // Reuses an open request of the member's own if there is one. The caller writes the audit entry
  // with the staff member's name and reason before calling this.
  async eraseNow(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { erasedAt: true } });
    if (!user || user.erasedAt) throw new NotFoundException("User not found");
    const existing = await this.prisma.dataRequest.findFirst({ where: { userId, kind: "erasure", activeSlot: OPEN } });
    const request = existing
      ? await this.prisma.dataRequest.update({ where: { id: existing.id }, data: { scheduledFor: now } })
      : await this.prisma.dataRequest.create({ data: { userId, kind: "erasure", status: "scheduled", activeSlot: OPEN, requestedAt: now, scheduledFor: now } });
    return this.erase(request.id, now);
  }

  enqueueErase(requestId: string) {
    return this.queue.add(JOB_ERASE, { requestId }, { jobId: idempotencyJobId("data-erase", requestId), attempts: 5, backoff: { type: "exponential", delay: Number(this.config.get("QUEUE_BACKOFF_MS")) || 60_000 }, removeOnComplete: { age: 86_400 }, removeOnFail: { age: 7 * 86_400 } });
  }

  // Queues every erasure whose grace period is over (and any that crashed half-way).
  async enqueueDue(now: Date): Promise<number> {
    const due = await this.prisma.dataRequest.findMany({
      where: {
        kind: "erasure",
        status: "scheduled",
        scheduledFor: { lte: now },
        OR: [{ startedAt: null }, { startedAt: { lte: new Date(now.getTime() - ERASE_RECLAIM_AFTER_MS) } }],
      },
      select: { id: true },
    });
    for (const r of due) {
      const old = await this.queue.getJob(idempotencyJobId("data-erase", r.id));
      if (old && ((await old.isFailed()) || (await old.isCompleted()))) await old.remove();
      await this.enqueueErase(r.id);
    }
    return due.length;
  }

  // The erasure itself. Safe to run twice: a request that is not due, not scheduled or already
  // completed is skipped, every step is a delete-where or a set-to-fixed-value, and removing
  // the Supabase login again is a success. `now` is a parameter so tests can move the clock.
  async erase(requestId: string, now = new Date()): Promise<"erased" | "skipped"> {
    const claimed = await this.prisma.dataRequest.updateMany({
      where: {
        id: requestId,
        kind: "erasure",
        status: "scheduled",
        scheduledFor: { lte: now },
        OR: [{ startedAt: null }, { startedAt: { lte: new Date(now.getTime() - ERASE_RECLAIM_AFTER_MS) } }],
      },
      data: { startedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count === 0) return "skipped";

    const request = await this.prisma.dataRequest.findUniqueOrThrow({ where: { id: requestId } });
    const userId = request.userId;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const address = user.email;

    try {
      // 1. The login (S-5). First, because it is the step that can fail on a network call: if it
      //    does, nothing is erased yet and the job retries with the account still intact.
      await this.credentials.deleteCredential(userId);

      // 2. Private files: bytes first (deleting a missing object is fine), rows in the transaction.
      const files = await this.prisma.storedFile.findMany({ where: { ownerId: userId }, select: { bucket: true, path: true } });
      for (const f of files) await this.storage.delete(f.bucket, f.path);

      // 3. The database, in one transaction.
      await this.prisma.$transaction(
        async (tx) => {
          const own = { userId };
          await tx.refreshToken.deleteMany({ where: own });
          await tx.passwordReset.deleteMany({ where: own });
          await tx.emailVerification.deleteMany({ where: own });
          await tx.emailVerificationCode.deleteMany({ where: own });
          await tx.userRole.deleteMany({ where: own });
          await tx.userCertification.deleteMany({ where: own });
          await tx.userSocialLinks.deleteMany({ where: own });
          await tx.profilePrivacy.deleteMany({ where: own });
          await tx.notificationSettings.deleteMany({ where: own });
          await tx.notificationPreference.deleteMany({ where: own });
          await tx.notificationPreferenceChange.deleteMany({ where: own });
          await tx.notificationDelivery.deleteMany({ where: own });
          await tx.notification.deleteMany({ where: own });
          await tx.memberSkill.deleteMany({ where: own });
          await tx.skillSuggestionSighting.deleteMany({ where: own });
          await tx.forumGuidelineAcceptance.deleteMany({ where: own });
          await tx.blogLike.deleteMany({ where: own });
          await tx.resourceLike.deleteMany({ where: own });
          await tx.recordingLike.deleteMany({ where: own });
          await tx.recordingParticipant.deleteMany({ where: own });
          await tx.forumReplyLike.deleteMany({ where: own });
          // Attempts that earned a certificate stay (the certificate points at them).
          await tx.quizAttempt.deleteMany({ where: { userId, certificate: { is: null } } });
          // Threads nobody else replied to; the rest stay as the tombstone's.
          await tx.forumThread.deleteMany({ where: { authorId: userId, replies: { none: { authorId: { not: userId } } } } });
          await tx.blogPost.deleteMany({ where: { authorId: userId, isPublished: false } });
          await tx.storedFile.deleteMany({ where: { ownerId: userId } });
          await tx.clientLog.updateMany({ where: own, data: { userId: null, ip: null } });
          await tx.user.update({
            where: { id: userId },
            data: {
              firstName: "Deleted",
              lastName: "member",
              // Unique and unusable, so the real address can register again.
              email: `erased-${userId}@erased.invalid`,
              passwordHash: null,
              whatsappNumber: null,
              professionalExperience: null,
              avatarUrl: null,
              bio: null,
              isApproved: false,
              approvedById: null,
              approvedAt: null,
              emailVerified: false,
              lastLoginAt: null,
              dateOfBirth: null,
              ageConfirmedAt: null,
              targetRole: null,
              careerGoals: null,
              onboardingCompletedAt: null,
              deactivatedAt: null,
              erasedAt: now,
            },
          });
          await tx.dataRequest.update({ where: { id: requestId }, data: { status: "completed", activeSlot: null, completedAt: now } });
          await this.audit.log(userId, "account_erased", "user", userId, { requestId }, "Erasure completed after the grace period", tx);
        },
        { timeout: 60_000, maxWait: 10_000 },
      );

    } catch (err) {
      // Give the claim back so the queue's retry (or the next sweep) can try again at once.
      await this.prisma.dataRequest.updateMany({ where: { id: requestId, status: "scheduled" }, data: { startedAt: null } });
      throw err;
    }

    // 4. Last notice, to the address that no longer exists on the account. Best effort.
    try {
      await this.emails.sendDataRightsNotice(address, { name: "data-rights-notice", kind: "erased", link: this.pageLink() }, { key: `erased-${requestId}` });
    } catch (err) {
      this.logger.warn(`Erasure ${requestId} done; final notice not sent: ${(err as Error).message}`);
    }
    return "erased";
  }
}
