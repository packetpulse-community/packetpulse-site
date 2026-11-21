import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ForumReputation,
  REPUTATION_HELPFUL_DAILY_CAP,
  REPUTATION_POINTS,
  REPUTATION_VOTER_PAIR_CAP,
  reputationLevel,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";

type Db = Prisma.TransactionClient | PrismaService;

// Reputation (PRD-026): rewards accepted and helpful answers, not activity. Every change is one
// row in the append-only ledger; a total is always SUM(points), so it can be recomputed and a
// reversal is a new negative row, never an edit. Abuse limits: no self-votes or self-accepts,
// a daily cap on helpful-vote points, a cap per voter and author pair, and reversal when the
// content goes away.
@Injectable()
export class ForumReputationService {
  constructor(private readonly prisma: PrismaService) {}

  /** The asker accepted this reply. The asker's own answer earns nothing. */
  async awardAccepted(db: Db, answerAuthorId: string, askerId: string, replyId: string, actorId: string) {
    if (answerAuthorId === askerId) return;
    const existing = await db.forumReputationEvent.findFirst({
      where: { kind: "answer_accepted", contentType: "reply", contentId: replyId, reversedBy: null },
    });
    if (existing) return;
    await db.forumReputationEvent.create({
      data: {
        userId: answerAuthorId,
        kind: "answer_accepted",
        points: REPUTATION_POINTS.answerAccepted,
        contentType: "reply",
        contentId: replyId,
        actorId,
      },
    });
  }

  /** Someone marked a reply helpful. Returns false when a limit meant no points were given. */
  async awardHelpful(db: Db, authorId: string, voterId: string, replyId: string): Promise<boolean> {
    if (authorId === voterId) return false;
    const dayAgo = new Date(Date.now() - 24 * 3600_000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600_000);
    const [today, pair] = await Promise.all([
      db.forumReputationEvent.aggregate({
        _sum: { points: true },
        where: { userId: authorId, kind: "helpful_vote", createdAt: { gte: dayAgo }, points: { gt: 0 } },
      }),
      db.forumReputationEvent.count({
        where: { userId: authorId, kind: "helpful_vote", actorId: voterId, createdAt: { gte: monthAgo }, points: { gt: 0 } },
      }),
    ]);
    if ((today._sum.points ?? 0) + REPUTATION_POINTS.helpfulVote > REPUTATION_HELPFUL_DAILY_CAP) return false;
    if (pair >= REPUTATION_VOTER_PAIR_CAP) return false;
    await db.forumReputationEvent.create({
      data: {
        userId: authorId,
        kind: "helpful_vote",
        points: REPUTATION_POINTS.helpfulVote,
        contentType: "reply",
        contentId: replyId,
        actorId: voterId,
      },
    });
    return true;
  }

  /** Cancels the events matching the filter that are still standing (each is reversed once). */
  async reverse(db: Db, where: Prisma.ForumReputationEventWhereInput) {
    const events = await db.forumReputationEvent.findMany({
      where: { ...where, kind: { not: "reversal" }, reversedBy: null, points: { not: 0 } },
    });
    for (const e of events) {
      await db.forumReputationEvent.create({
        data: {
          userId: e.userId,
          kind: "reversal",
          points: -e.points,
          contentType: e.contentType,
          contentId: e.contentId,
          actorId: e.actorId,
          reversesId: e.id,
        },
      });
    }
    return events.length;
  }

  reverseForReplies(db: Db, replyIds: string[]) {
    if (replyIds.length === 0) return Promise.resolve(0);
    return this.reverse(db, { contentType: "reply", contentId: { in: replyIds } });
  }

  /** A moderator removed a post: what it earned is taken back, then the penalty applies once. */
  async penalise(db: Db, authorId: string, contentType: "thread" | "reply", contentId: string, moderatorId: string, replyIds: string[] = []) {
    if (contentType === "reply") await this.reverseForReplies(db, [contentId]);
    else await this.reverseForReplies(db, replyIds);
    await db.forumReputationEvent.create({
      data: {
        userId: authorId,
        kind: "post_removed",
        points: REPUTATION_POINTS.postRemoved,
        contentType,
        contentId,
        actorId: moderatorId,
      },
    });
  }

  async forUsers(userIds: string[]): Promise<Map<string, ForumReputation>> {
    const ids = [...new Set(userIds)];
    const out = new Map<string, ForumReputation>();
    if (ids.length === 0) return out;
    const [sums, accepted] = await Promise.all([
      this.prisma.forumReputationEvent.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _sum: { points: true } }),
      this.prisma.$queryRaw<{ user_id: string; n: bigint }[]>`
        SELECT e.user_id, COUNT(*) AS n FROM forum_reputation_events e
        WHERE e.user_id IN (${Prisma.join(ids)}) AND e.kind = 'answer_accepted'
          AND NOT EXISTS (SELECT 1 FROM forum_reputation_events r WHERE r.reverses_id = e.id)
        GROUP BY e.user_id`,
    ]);
    for (const id of ids) {
      const points = Math.max(0, sums.find((s) => s.userId === id)?._sum.points ?? 0);
      out.set(id, {
        userId: id,
        points,
        level: reputationLevel(points),
        acceptedAnswers: Number(accepted.find((a) => a.user_id === id)?.n ?? 0),
      });
    }
    return out;
  }

  async forUser(userId: string): Promise<ForumReputation> {
    return (await this.forUsers([userId])).get(userId)!;
  }
}
