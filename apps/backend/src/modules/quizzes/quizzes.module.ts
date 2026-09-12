import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications";
import { AdminModule } from "../admin";
import { QuizzesController } from "./presentation/controllers/quizzes.controller";
import { QuizzesService } from "./application/services/quizzes.service";
import { QuizAttemptsService } from "./application/services/quiz-attempts.service";
import { CertificatesService } from "./application/services/certificates.service";

@Module({
  imports: [NotificationsModule, AdminModule],
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizAttemptsService, CertificatesService],
})
export class QuizzesModule {}
