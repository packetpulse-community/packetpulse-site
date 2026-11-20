-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_quiz_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_quiz_id_fkey";

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "deadline_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "max_attempts" INTEGER DEFAULT 3,
ADD COLUMN     "retake_gap_seconds" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_quiz_attempt_id_fkey" FOREIGN KEY ("quiz_attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
