import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SubmitQuizAttemptDto } from "../dto/quizzes.dto";
import { NotificationsService } from "../../../notifications";

@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async start(quizId: string, userId: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz || !quiz.isPublished) throw new NotFoundException("Quiz not found");

    return this.prisma.quizAttempt.create({ data: { quizId, userId } });
  }

  async listMine(quizId: string, userId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { quizId, userId },
      orderBy: { startedAt: "desc" },
      include: { certificate: true },
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
    if (attempt.status !== "in_progress") throw new BadRequestException("Attempt already submitted");

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
