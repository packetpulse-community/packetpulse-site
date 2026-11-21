import { Module, OnModuleInit, Logger } from "@nestjs/common";
import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { AdminModule } from "../admin/admin.module";
import { IdentityModule } from "../identity";
import { NotificationsModule } from "../notifications";
import { AccountErasureService } from "./application/account-erasure.service";
import { DataExportService } from "./application/data-export.service";
import { DataRightsService } from "./application/data-rights.service";
import { ExportCollectorService } from "./application/export-collector.service";
import { RetentionService } from "./application/retention.service";
import { DATA_RIGHTS_QUEUE, JOB_SWEEP, SWEEP_EVERY_MS, SWEEP_SCHEDULER_ID, DataRightsJob } from "./application/data-rights.constants";
import { DataRightsProcessor } from "./infrastructure/data-rights.processor";
import { AdminDataRequestsController, DataRightsController } from "./presentation/data-rights.controller";

@Module({
  imports: [BullModule.registerQueue({ name: DATA_RIGHTS_QUEUE }), AdminModule, IdentityModule, NotificationsModule],
  controllers: [DataRightsController, AdminDataRequestsController],
  providers: [DataRightsService, DataExportService, AccountErasureService, ExportCollectorService, RetentionService, DataRightsProcessor],
  exports: [AccountErasureService],
})
export class DataRightsModule implements OnModuleInit {
  private readonly logger = new Logger(DataRightsModule.name);

  constructor(
    @InjectQueue(DATA_RIGHTS_QUEUE) private readonly queue: Queue<DataRightsJob>,
    private readonly config: ConfigService,
  ) {}

  // The hourly sweep (due erasures, expired exports, retention). Registering the same scheduler id
  // again just updates it, so every replica can do this. Tests switch it off (a sweep running in
  // the background would race the assertions) and call the services with a fake clock instead.
  async onModuleInit() {
    if (this.config.get<string>("NODE_ENV") === "test" && this.config.get<string>("DATA_RIGHTS_SCHEDULER") !== "on") return;
    try {
      await this.queue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: SWEEP_EVERY_MS }, { name: JOB_SWEEP, data: {}, opts: { removeOnComplete: { count: 24 }, removeOnFail: { count: 24 } } });
    } catch (err) {
      this.logger.error(`The data-rights sweep could not be scheduled: ${(err as Error).message}`);
    }
  }
}
