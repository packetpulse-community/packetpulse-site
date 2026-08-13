import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { QuizzesService } from "../../application/services/quizzes.service";
import { QuizAttemptsService } from "../../application/services/quiz-attempts.service";
import { CertificatesService } from "../../application/services/certificates.service";
import { CreateQuizDto, QuizListQueryDto, SubmitQuizAttemptDto } from "../../application/dto/quizzes.dto";
import { Public, CurrentUser, RequirePermission, PERMISSIONS, SUPER_ADMIN_ROLE } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

function isAdminRoles(roles: string[]) {
  return roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
}

@Controller("quizzes")
export class QuizzesController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly attempts: QuizAttemptsService,
    private readonly certificates: CertificatesService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: QuizListQueryDto, @CurrentUser() user?: AccessTokenPayload) {
    return this.quizzes.list(query, user?.sub, !!user && isAdminRoles(user.roles));
  }

  // Static "certificates/*" routes registered before the ":id" catch-all below,
  // otherwise Nest would match "certificates" itself as an :id value.
  @Get("certificates/mine")
  myCertificates(@CurrentUser() user: AccessTokenPayload) {
    return this.certificates.listMine(user.sub);
  }

  @Public()
  @Get("certificates/verify/:certificateNumber")
  verifyCertificate(@Param("certificateNumber") certificateNumber: string) {
    return this.certificates.verify(certificateNumber);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.QUIZZES_AUTHOR)
  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(user.sub, dto);
  }

  @Public()
  @Get(":id")
  getForTaking(@Param("id") id: string) {
    return this.quizzes.getForTaking(id);
  }

  @Get(":id/edit")
  getForAuthoring(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.quizzes.getForAuthoring(id, user.sub, user.roles);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.QUIZZES_ATTEMPT)
  @Post(":id/attempts")
  startAttempt(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.attempts.start(id, user.sub);
  }

  @Get(":id/attempts/mine")
  listMyAttempts(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.attempts.listMine(id, user.sub);
  }

  @Throttle(WRITE_STANDARD)
  @Post(":id/attempts/:attemptId/submit")
  submitAttempt(
    @Param("id") id: string,
    @Param("attemptId") attemptId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: SubmitQuizAttemptDto,
  ) {
    return this.attempts.submit(id, attemptId, user.sub, dto);
  }
}
