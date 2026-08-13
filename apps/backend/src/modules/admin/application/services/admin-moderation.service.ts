import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class AdminModerationService {
  constructor(private readonly prisma: PrismaService) {}

  pendingResources() {
    return this.prisma.resource.findMany({
      where: { isApproved: false },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approveResource(id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Resource not found");
    return this.prisma.resource.update({ where: { id }, data: { isApproved: true } });
  }

  pendingRecordings() {
    return this.prisma.recording.findMany({
      where: { isApproved: false },
      include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approveRecording(id: string) {
    const recording = await this.prisma.recording.findUnique({ where: { id } });
    if (!recording) throw new NotFoundException("Recording not found");
    return this.prisma.recording.update({ where: { id }, data: { isApproved: true } });
  }
}
