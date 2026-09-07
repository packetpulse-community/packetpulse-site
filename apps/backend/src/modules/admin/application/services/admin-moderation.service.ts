import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "./admin-activity-log.service";

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: AdminActivityLogService,
  ) {}

  pendingResources() {
    return this.prisma.resource.findMany({
      where: { isApproved: false },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approveResource(id: string, actorId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Resource not found");
    const updated = await this.prisma.resource.update({ where: { id }, data: { isApproved: true } });
    await this.activityLog.log(actorId, "resource_approved", "resource", id, { title: resource.title });
    return updated;
  }

  async unapproveResource(id: string, actorId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Resource not found");
    const updated = await this.prisma.resource.update({ where: { id }, data: { isApproved: false } });
    await this.activityLog.log(actorId, "resource_unapproved", "resource", id, { title: resource.title });
    return updated;
  }

  pendingRecordings() {
    return this.prisma.recording.findMany({
      where: { isApproved: false },
      include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approveRecording(id: string, actorId: string) {
    const recording = await this.prisma.recording.findUnique({ where: { id } });
    if (!recording) throw new NotFoundException("Recording not found");
    const updated = await this.prisma.recording.update({ where: { id }, data: { isApproved: true } });
    await this.activityLog.log(actorId, "recording_approved", "recording", id, { title: recording.title });
    return updated;
  }

  async unapproveRecording(id: string, actorId: string) {
    const recording = await this.prisma.recording.findUnique({ where: { id } });
    if (!recording) throw new NotFoundException("Recording not found");
    const updated = await this.prisma.recording.update({ where: { id }, data: { isApproved: false } });
    await this.activityLog.log(actorId, "recording_unapproved", "recording", id, { title: recording.title });
    return updated;
  }

  pendingBlogs() {
    return this.prisma.blogPost.findMany({
      where: { isApproved: false },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approveBlog(id: string, actorId: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Blog post not found");
    const updated = await this.prisma.blogPost.update({ where: { id }, data: { isApproved: true } });
    await this.activityLog.log(actorId, "blog_approved", "blog_post", id, { title: post.title });
    return updated;
  }

  async unapproveBlog(id: string, actorId: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Blog post not found");
    const updated = await this.prisma.blogPost.update({ where: { id }, data: { isApproved: false } });
    await this.activityLog.log(actorId, "blog_unapproved", "blog_post", id, { title: post.title });
    return updated;
  }
}
