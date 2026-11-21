import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { ConsentModule } from "../consent";
import { FilesModule } from "../files";
import { ResumesController } from "./presentation/resumes.controller";
import { ResumesService } from "./application/resumes.service";
import { ResumeParseService } from "./application/resume-parse.service";
import { DocumentExtractor } from "./infrastructure/document-extractor";
import { ResumeProcessor } from "./infrastructure/resume.processor";
import { JOB_SWEEP, RESUME_QUEUE, ResumeJob, SWEEP_EVERY_MS, SWEEP_SCHEDULER_ID } from "./application/resumes.constants";

// Resume upload, parsing and review (TASK-024). Files go through FilesModule's private pipeline;
// FeatureFlagsService and StorageProvider come from global modules.
@Module({
  imports: [BullModule.registerQueue({ name: RESUME_QUEUE }), FilesModule, ConsentModule],
  controllers: [ResumesController],
  providers: [ResumesService, ResumeParseService, DocumentExtractor, ResumeProcessor],
  exports: [ResumesService],
})
export class ResumesModule implements OnModuleInit {
  private readonly logger = new Logger(ResumesModule.name);

  constructor(
    @InjectQueue(RESUME_QUEUE) private readonly queue: Queue<ResumeJob>,
    private readonly config: ConfigService,
  ) {}

  // Housekeeping every few minutes (re-queue lost parses, drop abandoned uploads). Registering the
  // same scheduler id again just updates it, so every replica can do this. Tests switch it off and
  // call ResumeParseService.sweep with a fake clock.
  async onModuleInit() {
    if (this.config.get<string>("NODE_ENV") === "test" && this.config.get<string>("RESUMES_SCHEDULER") !== "on") return;
    try {
      await this.queue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: SWEEP_EVERY_MS }, { name: JOB_SWEEP, data: {}, opts: { removeOnComplete: { count: 24 }, removeOnFail: { count: 24 } } });
    } catch (err) {
      this.logger.error(`The resume sweep could not be scheduled: ${(err as Error).message}`);
    }
  }
}
