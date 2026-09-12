import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { CreateQuizDto, QuizListQueryDto, UpdateQuizDto } from "../dto/quizzes.dto";
import { SUPER_ADMIN_ROLE } from "../../../identity";
import { AdminActivityLogService } from "../../../admin";

const summarySelect = {
  id: true,
  title: true,
  description: true,
  category: { select: { id: true, name: true, slug: true } },
  passingScorePct: true,
  timeLimitSeconds: true,
  isPublished: true,
  createdById: true,
  createdAt: true,
  _count: { select: { questions: true } },
} satisfies Prisma.QuizSelect;

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: AdminActivityLogService,
  ) {}

  async list(query: QuizListQueryDto, userId?: string, isAdmin = false) {
    const skip = prismaSkip(query.page, query.limit);
    const where: Prisma.QuizWhereInput = {
      categoryId: query.categoryId,
      // Non-owners/non-admins only ever see published quizzes.
      OR: isAdmin ? undefined : [{ isPublished: true }, { createdById: userId }],
    };

    const [data, total] = await Promise.all([
      this.prisma.quiz.findMany({ where, select: summarySelect, orderBy: { createdAt: "desc" }, skip, take: query.limit }),
      this.prisma.quiz.count({ where }),
    ]);
    return paginate(data, query.page, query.limit, total);
  }

  // Quiz-taking view — strips isCorrect from options so an attendee can't inspect
  // the answer key from the network response before submitting.
  async getForTaking(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        questions: {
          orderBy: { position: "asc" },
          include: { options: { orderBy: { position: "asc" }, select: { id: true, optionText: true, position: true } } },
        },
      },
    });
    if (!quiz || !quiz.isPublished) throw new NotFoundException("Quiz not found");
    return quiz;
  }

  // Authoring view — includes isCorrect, only for the quiz's creator or an admin.
  async getForAuthoring(id: string, userId: string, roles: string[]) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
      },
    });
    if (!quiz) throw new NotFoundException("Quiz not found");
    this.assertOwnerOrAdmin(quiz.createdById, userId, roles);
    return quiz;
  }

  async create(createdById: string, dto: CreateQuizDto) {
    const quiz = await this.prisma.quiz.create({
      data: {
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        passingScorePct: dto.passingScorePct,
        timeLimitSeconds: dto.timeLimitSeconds,
        isPublished: dto.isPublished,
        createdById,
        questions: {
          create: dto.questions.map((q, position) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            position,
            options: {
              create: q.options.map((o, optionPosition) => ({
                optionText: o.optionText,
                isCorrect: o.isCorrect,
                position: optionPosition,
              })),
            },
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    });
    await this.activityLog.log(createdById, "quiz_created", "quiz", quiz.id, { title: quiz.title });
    return quiz;
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateQuizDto) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException("Quiz not found");
    this.assertOwnerOrAdmin(quiz.createdById, userId, roles);
    const updated = await this.prisma.quiz.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        passingScorePct: dto.passingScorePct,
        timeLimitSeconds: dto.timeLimitSeconds,
        isPublished: dto.isPublished,
      },
      select: summarySelect,
    });
    await this.activityLog.log(userId, "quiz_updated", "quiz", id, { title: updated.title });
    return updated;
  }

  async delete(id: string, userId: string, roles: string[]) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException("Quiz not found");
    this.assertOwnerOrAdmin(quiz.createdById, userId, roles);
    await this.prisma.quiz.delete({ where: { id } });
    await this.activityLog.log(userId, "quiz_deleted", "quiz", id, { title: quiz.title });
    return { success: true };
  }

  private assertOwnerOrAdmin(ownerId: string, userId: string, roles: string[]) {
    const isOwner = ownerId === userId;
    const isAdmin = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
    if (!isOwner && !isAdmin) throw new ForbiddenException("You do not own this quiz");
  }
}
