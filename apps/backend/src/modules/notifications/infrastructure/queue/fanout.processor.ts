import { Logger, Optional } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, UnrecoverableError } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { RealtimeEmitterService } from "../../../../common/realtime/realtime-emitter.service";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher.service";
import { FanoutJobData } from "../../application/services/notifications.service";
import { FANOUT_QUEUE, STALL_SETTINGS } from "./queue-config";
import { handleJobFailed, handleJobStalled, handleWorkerError } from "./queue-alerts";

@Processor(FANOUT_QUEUE, { concurrency: 5, ...STALL_SETTINGS })
export class FanoutProcessor extends WorkerHost {
  private readonly logger = new Logger(FanoutProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitterService,
    // Optional: without it only the in-app row is written, as before TASK-021.
    @Optional() private readonly dispatcher?: NotificationDispatcher,
  ) {
    super();
  }

  async process(job: Job<FanoutJobData>) {
    const { userId, type, payload } = job.data;
    let notification;
    try {
      notification = await this.prisma.notification.create({
        data: { userId, type, payload: payload as Prisma.InputJsonValue },
      });
    } catch (err) {
      // P2003 = the recipient no longer exists; retrying cannot create the row.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new UnrecoverableError("Notification recipient no longer exists");
      }
      throw err;
    }
    // The row is saved; the socket push is best effort. Failing the job here would retry
    // and insert a second row for the same event.
    try {
      await this.realtime.emit(userId, "notification", notification);
    } catch (err) {
      this.logger.warn(`Realtime push failed (notification saved) job=${job.id}: ${(err as Error).message}`);
    }
    // Per-channel decisions (email, WhatsApp) and the delivery log. Failing the job here would
    // retry and insert a second notification row, so a failure is logged and not retried.
    try {
      await this.dispatcher?.dispatch({
        userId,
        type,
        notificationId: notification.id,
        critical: job.data.critical,
      });
    } catch (err) {
      this.logger.error(`Dispatch failed (notification saved) job=${job.id} type=${type}: ${(err as Error).message}`);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<FanoutJobData> | undefined, error: Error) {
    handleJobFailed(this.logger, FANOUT_QUEUE, job, error, { type: job?.data.type });
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string) {
    handleJobStalled(this.logger, FANOUT_QUEUE, jobId);
  }

  @OnWorkerEvent("error")
  onError(error: Error) {
    handleWorkerError(this.logger, FANOUT_QUEUE, error);
  }
}
