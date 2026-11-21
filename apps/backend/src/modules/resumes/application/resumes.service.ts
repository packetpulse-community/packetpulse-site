import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_SKILL_VISIBILITY,
  MAX_MEMBER_SKILLS,
  RESUME_MAX_BYTES,
  RESUME_MAX_VERSIONS,
} from "@packetpulse/types";
import type {
  CreateResumeUploadDto,
  EducationSuggestionData,
  ExperienceSuggestionData,
  ProfileEntries,
  ResumeOverview,
  ResumeSuggestionView,
  ResumeUploadStart,
  ResumeView,
  SkillSuggestionData,
} from "@packetpulse/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { FilesService } from "../../files/application/services/files.service";
import { ConsentService } from "../../consent";
import { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import { idempotencyJobId } from "../../notifications/infrastructure/queue/queue-config";
import { CURRENT_SLOT, JOB_PARSE, PARSE_MAX_ATTEMPTS, RESUME_QUEUE, ResumeJob } from "./resumes.constants";
import { toResumeView, toSuggestionView } from "./resume.view";

type Actor = { sub: string; roles: string[] };

const fileSelect = { originalName: true, contentType: true, sizeBytes: true } as const;

export const CONSENT_NEEDED_MESSAGE =
  "Please agree to share your resume with PacketPulse reviewers before uploading. You can change your mind at any time in your privacy settings.";
export const FILE_NOT_ACCEPTED_MESSAGE = "We could not accept this file. Check that it is a PDF or a Word (.docx) file under 5 MB, then try again.";

// Resume upload, versions and suggestions (TASK-024). The bytes travel through the private file
// pipeline (signed direct upload, type and size checks, scan, one canOpen policy, access log);
// this service adds consent, the one-current-resume rule and the review of parsed suggestions.
@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly consent: ConsentService,
    private readonly flags: FeatureFlagsService,
    private readonly config: ConfigService,
    @InjectQueue(RESUME_QUEUE) private readonly queue: Queue<ResumeJob>,
  ) {}

  // ------------------------------------------------------------------------------ reading

  async overview(userId: string): Promise<ResumeOverview> {
    const [rows, consentGranted] = await Promise.all([
      this.prisma.resume.findMany({
        where: { userId, status: { not: "awaiting_upload" } },
        include: { file: { select: fileSelect } },
        orderBy: { version: "desc" },
      }),
      this.consent.isGranted(userId, "resume_sharing"),
    ]);
    const current = rows.find((r) => r.activeSlot === CURRENT_SLOT) ?? null;
    const suggestions = current
      ? (await this.prisma.resumeSuggestion.findMany({ where: { resumeId: current.id, userId }, orderBy: [{ kind: "asc" }, { createdAt: "asc" }, { id: "asc" }] })).map(toSuggestionView)
      : [];
    return {
      current: current ? toResumeView(current) : null,
      suggestions,
      history: rows.filter((r) => r.id !== current?.id).map(toResumeView),
      consentGranted,
      maxBytes: RESUME_MAX_BYTES,
      maxVersions: RESUME_MAX_VERSIONS,
    };
  }

  private async mine(userId: string, id: string) {
    const row = await this.prisma.resume.findFirst({ where: { id, userId }, include: { file: { select: fileSelect } } });
    if (!row) throw new NotFoundException("Resume not found");
    return row;
  }

  // The member opens their own resume through the shared file pipeline (a 60-second signed link;
  // every open is written to the file access log).
  async link(user: Actor, id: string, ip?: string) {
    const row = await this.mine(user.sub, id);
    if (row.status === "awaiting_upload" || row.status === "rejected") throw new NotFoundException("Resume not found");
    return this.files.link(user, row.fileId, ip);
  }

  // ------------------------------------------------------------------------------ upload

  async startUpload(user: Actor, dto: CreateResumeUploadDto, ip?: string): Promise<ResumeUploadStart> {
    await this.flags.assertEnabled("resumes.upload", "Resume upload");
    await this.flags.assertEnabled("files.uploads", "File uploads");
    if (!(await this.consent.isGranted(user.sub, "resume_sharing"))) throw new ForbiddenException(CONSENT_NEEDED_MESSAGE);

    // An earlier upload that was never completed is dropped, so there is at most one in flight.
    const stale = await this.prisma.resume.findMany({ where: { userId: user.sub, status: "awaiting_upload" }, select: { id: true, fileId: true } });
    for (const s of stale) await this.discard(user, s.id, s.fileId, ip);

    const created = await this.files.createUploadUrl(
      user,
      { kind: "resume", originalName: dto.originalName, contentType: dto.contentType, sizeBytes: dto.sizeBytes },
      ip,
      true,
    );
    try {
      const resume = await this.createRow(user.sub, created.file.id);
      return {
        resume: toResumeView({ ...resume, file: { originalName: created.file.originalName, contentType: created.file.contentType, sizeBytes: created.file.sizeBytes } }),
        uploadUrl: created.uploadUrl,
        method: "PUT",
        expiresInSeconds: created.expiresInSeconds,
      };
    } catch (err) {
      await this.files.remove(user, created.file.id, ip, true).catch(() => undefined);
      throw err;
    }
  }

  // The next version number. Two uploads started in the same instant race on the unique index; the
  // loser retries once with the fresh maximum.
  private async createRow(userId: string, fileId: string) {
    for (let attempt = 0; ; attempt++) {
      const max = await this.prisma.resume.aggregate({ where: { userId }, _max: { version: true } });
      try {
        return await this.prisma.resume.create({ data: { userId, fileId, version: (max._max.version ?? 0) + 1 } });
      } catch (err) {
        if (attempt < 2 && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }
    }
  }

  private async discard(user: Actor, resumeId: string, fileId: string, ip?: string) {
    await this.files.remove(user, fileId, ip, true).catch((err: Error) => this.logger.warn(`Resume file ${fileId} not removed: ${err.message}`));
    await this.prisma.resume.deleteMany({ where: { id: resumeId } });
  }

  async complete(user: Actor, id: string, ip?: string): Promise<ResumeView> {
    await this.flags.assertEnabled("resumes.upload", "Resume upload");
    const row = await this.mine(user.sub, id);
    if (row.status !== "awaiting_upload") return toResumeView(row); // idempotent: already completed

    try {
      await this.files.complete(user, row.fileId, ip, true);
    } catch (err) {
      // Not a valid file: the pipeline already removed the bytes, so the resume goes too. A scanner
      // that is down (503) leaves everything as it is so the same call can be repeated.
      if (err instanceof BadRequestException) {
        await this.prisma.resume.deleteMany({ where: { id: row.id } });
        throw new BadRequestException(FILE_NOT_ACCEPTED_MESSAGE);
      }
      throw err;
    }

    // The new version becomes current only now that it is safely stored, so a failed replacement
    // never costs the member the resume they had.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.resume.updateMany({ where: { userId: user.sub, activeSlot: CURRENT_SLOT, id: { not: row.id } }, data: { activeSlot: null } });
      return tx.resume.update({
        where: { id: row.id },
        data: { status: "parsing", activeSlot: CURRENT_SLOT, parseRun: 1, parseStartedAt: null, failureCode: null, parsedAt: null },
        include: { file: { select: fileSelect } },
      });
    });
    await this.pruneHistory(user, ip);
    await this.enqueueParse(updated.id, updated.parseRun);
    return toResumeView(updated);
  }

  // Keeps the newest RESUME_MAX_VERSIONS versions (the current one included).
  private async pruneHistory(user: Actor, ip?: string) {
    const kept = await this.prisma.resume.findMany({
      where: { userId: user.sub, status: { not: "awaiting_upload" } },
      orderBy: { version: "desc" },
      select: { id: true, fileId: true, activeSlot: true },
    });
    for (const old of kept.slice(RESUME_MAX_VERSIONS).filter((r) => r.activeSlot !== CURRENT_SLOT)) await this.discard(user, old.id, old.fileId, ip);
  }

  async enqueueParse(resumeId: string, run: number) {
    try {
      await this.queue.add(
        JOB_PARSE,
        { resumeId, run },
        {
          jobId: idempotencyJobId("resume-parse", resumeId, String(run)),
          attempts: PARSE_MAX_ATTEMPTS,
          backoff: { type: "exponential", delay: Number(this.config.get("QUEUE_BACKOFF_MS")) || 30_000 },
          removeOnComplete: { age: 86_400, count: 1000 },
          removeOnFail: { age: 7 * 86_400, count: 1000 },
        },
      );
    } catch (err) {
      // Not fatal: the resume stays "parsing" and the sweep queues it again.
      this.logger.warn(`Resume ${resumeId} not queued yet: ${(err as Error).message}`);
    }
  }

  /** "Try again" after a failed read. A new run number is a new job id, so the old finished job cannot swallow it. */
  async retry(user: Actor, id: string): Promise<ResumeView> {
    await this.flags.assertEnabled("resumes.upload", "Resume upload");
    const row = await this.mine(user.sub, id);
    if (row.status !== "failed") {
      if (row.status === "parsing") return toResumeView(row); // already being read
      throw new ConflictException("This resume cannot be read again.");
    }
    const updated = await this.prisma.resume.update({
      where: { id: row.id },
      data: { status: "parsing", failureCode: null, parseStartedAt: null, parseRun: { increment: 1 } },
      include: { file: { select: fileSelect } },
    });
    await this.enqueueParse(updated.id, updated.parseRun);
    return toResumeView(updated);
  }

  // ------------------------------------------------------------------------------ delete

  // Removes the file and the suggestions. Skills and entries the member already accepted stay on the
  // profile: they are the member's own profile data, not the resume.
  async remove(user: Actor, id: string, ip?: string) {
    const row = await this.mine(user.sub, id);
    await this.files.remove(user, row.fileId, ip, true);
    await this.prisma.resume.deleteMany({ where: { id: row.id } });
    return { success: true };
  }

  // ------------------------------------------------------------------------ suggestions

  async decide(userId: string, suggestionId: string, decision: "accept" | "reject"): Promise<ResumeSuggestionView> {
    const s = await this.prisma.resumeSuggestion.findFirst({ where: { id: suggestionId, userId } });
    if (!s) throw new NotFoundException("Suggestion not found");
    const target = decision === "accept" ? "accepted" : "rejected";
    if (s.status === target) return toSuggestionView(s); // idempotent
    if (s.status === "accepted") throw new ConflictException("This is already on your profile. Remove it from your profile instead.");

    const now = new Date();
    if (decision === "reject") {
      return toSuggestionView(await this.prisma.resumeSuggestion.update({ where: { id: s.id }, data: { status: "rejected", decidedAt: now } }));
    }
    const done = await this.prisma.$transaction(async (tx) => {
      await this.apply(tx, userId, s.id, s.kind, s.data);
      return tx.resumeSuggestion.update({ where: { id: s.id }, data: { status: "accepted", decidedAt: now } });
    });
    return toSuggestionView(done);
  }

  private async apply(tx: Prisma.TransactionClient, userId: string, suggestionId: string, kind: string, raw: Prisma.JsonValue) {
    if (kind === "skill") {
      const d = raw as unknown as SkillSuggestionData;
      const skill = await tx.skill.findFirst({ where: { id: d.skillId, status: "active" }, select: { id: true } });
      if (!skill) throw new ConflictException("That skill is no longer in the skill list.");
      const held = await tx.memberSkill.findUnique({ where: { userId_skillId: { userId, skillId: skill.id } }, select: { skillId: true } });
      if (held) return;
      if ((await tx.memberSkill.count({ where: { userId } })) >= MAX_MEMBER_SKILLS) {
        throw new ConflictException(`You already have ${MAX_MEMBER_SKILLS} skills on your profile. Remove one before adding another.`);
      }
      await tx.memberSkill.create({ data: { userId, skillId: skill.id, visibility: DEFAULT_SKILL_VISIBILITY } });
    } else if (kind === "education") {
      const d = raw as unknown as EducationSuggestionData;
      await tx.memberEducation.upsert({
        where: { sourceSuggestionId: suggestionId },
        update: {},
        create: { userId, sourceSuggestionId: suggestionId, institution: d.institution, qualification: d.qualification, startYear: d.startYear, endYear: d.endYear },
      });
    } else if (kind === "experience") {
      const d = raw as unknown as ExperienceSuggestionData;
      await tx.memberExperience.upsert({
        where: { sourceSuggestionId: suggestionId },
        update: {},
        create: { userId, sourceSuggestionId: suggestionId, title: d.title, company: d.company, startDate: d.startDate, endDate: d.endDate, current: d.current },
      });
    } else {
      throw new BadRequestException("Unknown suggestion type");
    }
  }

  // ------------------------------------------------------------------ profile entries

  async entries(userId: string): Promise<ProfileEntries> {
    const [education, experience] = await Promise.all([
      this.prisma.memberEducation.findMany({ where: { userId }, orderBy: [{ endYear: "desc" }, { createdAt: "asc" }] }),
      this.prisma.memberExperience.findMany({ where: { userId }, orderBy: [{ startDate: "desc" }, { createdAt: "asc" }] }),
    ]);
    return {
      education: education.map((e) => ({ id: e.id, institution: e.institution, qualification: e.qualification, startYear: e.startYear, endYear: e.endYear, createdAt: e.createdAt.toISOString() })),
      experience: experience.map((e) => ({ id: e.id, title: e.title, company: e.company, startDate: e.startDate, endDate: e.endDate, current: e.current, createdAt: e.createdAt.toISOString() })),
    };
  }

  // Removing an entry puts the suggestion that created it back to "pending", so the member can
  // accept it again or reject it.
  async removeEntry(userId: string, kind: "education" | "experience", id: string) {
    await this.prisma.$transaction(async (tx) => {
      const row =
        kind === "education"
          ? await tx.memberEducation.findFirst({ where: { id, userId }, select: { sourceSuggestionId: true } })
          : await tx.memberExperience.findFirst({ where: { id, userId }, select: { sourceSuggestionId: true } });
      if (!row) throw new NotFoundException("Entry not found");
      if (kind === "education") await tx.memberEducation.deleteMany({ where: { id, userId } });
      else await tx.memberExperience.deleteMany({ where: { id, userId } });
      if (row.sourceSuggestionId) {
        await tx.resumeSuggestion.updateMany({ where: { id: row.sourceSuggestionId, userId }, data: { status: "pending", decidedAt: null } });
      }
    });
    return { success: true };
  }
}
