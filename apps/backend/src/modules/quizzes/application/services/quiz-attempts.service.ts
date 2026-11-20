import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { QuizAttemptBlockReason, QuizAttemptStatus } from "@packetpulse/types";
import type { Quiz, QuizAttempt } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SubmitQuizAttemptDto } from "../dto/quizzes.dto";
import { NotificationsService } from "../../../notifications";

// Network and clock slack allowed on top of the deadline before a submission is refused.
export const SUBMIT_GRACE_MS = 5_000;

type QuizPolicy = Pick<Quiz, "maxAttempts" | "retakeGapSeconds" | "expiresAt" | "archivedAt">;
type AttemptRow = Pick<QuizAttempt, "id" | "status" | "startedAt" | "submittedAt" | "deadlineAt">;

@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Starts an attempt, or resumes the one already running (so a reload or a second tab
  // can never burn an extra attempt, and the deadline stays the one fixed at the start).
  // The count, gap and expiry checks run under a per-(user, quiz) advisory lock so two
  // parallel requests cannot both slip under the cap.
  async start(quizId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quiz-attempt:${userId}:${quizId}`}))`;
      const quiz = await tx.quiz.findUnique({ where: { id: quizId } });
      if (!quiz || !quiz.isPublished || quiz.archivedAt) throw new NotFoundException("Quiz not found");

      const now = new Date();
      await this.expireStale(tx, quizId, userId, now);
      const attempts = await tx.quizAttempt.findMany({ where: { quizId, userId }, orderBy: { startedAt: "desc" } });

      // serverNow lets the screen run a countdown against the server's clock, not its own.
      const running = attempts.find((a) => a.status === "in_progress");
      if (running) return { ...running, serverNow: now.toISOString() };

      const block = this.blockFor(quiz, attempts, now);
      if (block) throw new ConflictException(this.blockMessage(block.reason, block.nextAttemptAt));

      const created = await tx.quizAttempt.create({
        data: {
          quizId,
          userId,
          startedAt: now,
          deadlineAt: quiz.timeLimitSeconds ? new Date(now.getTime() + quiz.timeLimitSeconds * 1000) : null,
        },
      });
      return { ...created, serverNow: now.toISOString() };
    });
  }

  async listMine(quizId: string, userId: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException("Quiz not found");
    const now = new Date();
    await this.expireStale(this.prisma, quizId, userId, now);
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId, userId },
      orderBy: { startedAt: "desc" },
      include: { certificate: true },
    });
    return { attempts, status: this.statusFor(quiz, attempts, now) };
  }

  private statusFor(quiz: QuizPolicy, attempts: AttemptRow[], now: Date): QuizAttemptStatus {
    const block = this.blockFor(quiz, attempts, now);
    const running = attempts.find((a) => a.status === "in_progress");
    const used = attempts.length;
    return {
      serverNow: now.toISOString(),
      maxAttempts: quiz.maxAttempts,
      attemptsUsed: used,
      attemptsRemaining: quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - used),
      // A running attempt can always be resumed; otherwise no block means it can start.
      canStart: !!running || !block,
      blockedReason: running ? null : (block?.reason ?? null),
      nextAttemptAt: running ? null : (block?.nextAttemptAt?.toISOString() ?? null),
      quizExpiresAt: quiz.expiresAt?.toISOString() ?? null,
      inProgress: running
        ? { id: running.id, startedAt: running.startedAt.toISOString(), deadlineAt: running.deadlineAt?.toISOString() ?? null }
        : null,
    };
  }

  // Why a new attempt cannot start right now, or null when it can. `attempts` is every
  // attempt by this user on this quiz (running, submitted and expired ones all count
  // against the cap, so abandoning an attempt does not give it back).
  private blockFor(
    quiz: QuizPolicy,
    attempts: AttemptRow[],
    now: Date,
  ): { reason: QuizAttemptBlockReason; nextAttemptAt: Date | null } | null {
    if (quiz.archivedAt) return { reason: "quiz_archived", nextAttemptAt: null };
    if (quiz.expiresAt && quiz.expiresAt <= now) return { reason: "quiz_expired", nextAttemptAt: null };
    if (quiz.maxAttempts !== null && attempts.length >= quiz.maxAttempts) {
      return { reason: "limit_reached", nextAttemptAt: null };
    }
    if (quiz.retakeGapSeconds > 0) {
      const ends = attempts.map((a) => (a.submittedAt ?? a.deadlineAt ?? a.startedAt).getTime());
      if (ends.length > 0) {
        const next = new Date(Math.max(...ends) + quiz.retakeGapSeconds * 1000);
        if (next > now) return { reason: "retake_gap", nextAttemptAt: next };
      }
    }
    return null;
  }

  private blockMessage(reason: QuizAttemptBlockReason, nextAttemptAt: Date | null) {
    switch (reason) {
      case "limit_reached":
        return "You have used all your attempts for this quiz.";
      case "retake_gap":
        return `You can retake this quiz after ${nextAttemptAt?.toISOString() ?? "the waiting period ends"}.`;
      case "quiz_expired":
        return "This quiz has closed and no longer accepts attempts.";
      case "quiz_archived":
        return "This quiz has been retired and no longer accepts attempts.";
    }
  }

  // Attempts left running past their deadline (plus the grace period) are marked expired
  // here, lazily, whenever the user touches the quiz; they keep counting as an attempt.
  private async expireStale(db: Pick<PrismaService, "quizAttempt">, quizId: string, userId: string, now: Date) {
    await db.quizAttempt.updateMany({
      where: { quizId, userId, status: "in_progress", deadlineAt: { lt: new Date(now.getTime() - SUBMIT_GRACE_MS) } },
      data: { status: "expired" },
    });
  }

  // Scores by exact-match of selected vs. correct option ids per question — a
  // reasonable rule for both single- and multi-choice questions. Certificate
  // issuance is wired here for real (unlike the old app, which had no quiz feature
  // at all); PDF rendering for certificates.pdfUrl is a Phase 5 background job —
  // the certificate record itself is authoritative regardless of when the PDF lands.
  async submit(quizId: string, attemptId: string, userId: string, dto: SubmitQuizAttemptDto) {
    const attempt = await this.prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.quizId !== quizId) throw new NotFoundException("Attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("Not your attempt");
    if (attempt.status === "expired") throw new ConflictException("The time limit for this attempt has passed.");
    if (attempt.status !== "in_progress") throw new BadRequestException("Attempt already submitted");

    // Server-side deadline (S-7): the browser timer is only a display. A late submission
    // is rejected, not scored; the attempt is marked expired and still counts.
    if (attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS) {
      await this.prisma.quizAttempt.updateMany({ where: { id: attemptId, status: "in_progress" }, data: { status: "expired" } });
      throw new ConflictException("The time limit for this attempt has passed.");
    }

    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: { questions: { include: { options: true } } },
    });

    let earnedPoints = 0;
    let totalPoints = 0;
    const answerRows: { questionId: string; selectedOptionIds: string[]; isCorrect: boolean }[] = [];

    for (const question of quiz.questions) {
      totalPoints += question.points;
      const submitted = dto.answers.find((a) => a.questionId === question.id);
      const selected = new Set(submitted?.selectedOptionIds ?? []);
      const correct = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
      const isCorrect =
        selected.size === correct.size && [...selected].every((id) => correct.has(id));
      if (isCorrect) earnedPoints += question.points;
      answerRows.push({ questionId: question.id, selectedOptionIds: [...selected], isCorrect });
    }

    const scorePct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = scorePct >= quiz.passingScorePct;

    const [, , updatedAttempt] = await this.prisma.$transaction([
      this.prisma.quizAttemptAnswer.createMany({
        data: answerRows.map((a) => ({ ...a, attemptId })),
      }),
      this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: { status: "submitted", submittedAt: new Date(), scorePct, passed },
      }),
      this.prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } }),
    ]);

    let certificate = null;
    if (passed) {
      certificate = await this.prisma.certificate.create({
        data: {
          userId,
          quizId,
          quizAttemptId: attemptId,
          certificateNumber: this.generateCertificateNumber(),
        },
      });
      await this.notifications.notify(userId, "certificate_issued", {
        quizId,
        quizTitle: quiz.title,
        certificateId: certificate.id,
        certificateNumber: certificate.certificateNumber,
      });
    }

    return { attempt: updatedAttempt, scorePct, passed, certificate };
  }

  private generateCertificateNumber(): string {
    return `PP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }
}
