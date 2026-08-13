import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { RealtimeEmitterService } from "../../../../common/realtime/realtime-emitter.service";
import { FanoutJobData } from "../../application/services/notifications.service";

@Processor("fanout")
export class FanoutProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEmitterService,
  ) {
    super();
  }

  async process(job: Job<FanoutJobData>) {
    const { userId, type, payload } = job.data;
    const notification = await this.prisma.notification.create({
      data: { userId, type, payload: payload as Prisma.InputJsonValue },
    });
    await this.realtime.emit(userId, "notification", notification);
  }
}
