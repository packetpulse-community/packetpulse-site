import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageProvider } from "../../../common/storage/storage-provider";


const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// A notification payload can name the other member who caused it (fromUserId on a forum reply).
// That id is not the member's data, so every user-id key but the member's own is dropped.
const OTHER_PERSON_KEY = /(^|[a-z])(UserId|ById)$|^(actorId|fromId)$/;
function ownPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ownPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !OTHER_PERSON_KEY.test(k))
        .map(([k, v]) => [k, ownPayload(v)]),
    );
  }
  return value;
}

// Builds the files of one member's export. Every query is scoped by `userId` and nothing is
// selected that belongs to somebody else: no other member's name, email or id, no password hash,
// no token hash, no IP-hash, no staff notes. Content the member wrote is theirs to take; content
// others wrote in the same thread is not included.
@Injectable()
export class ExportCollectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
  ) {}

  async collect(userId: string, now: Date): Promise<{ name: string; data: Buffer }[] | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        whatsappNumber: true,
        professionalExperience: true,
        avatarUrl: true,
        bio: true,
        dateOfBirth: true,
        ageConfirmedAt: true,
        targetRole: true,
        careerGoals: true,
        isApproved: true,
        emailVerified: true,
        lastLoginAt: true,
        onboardingCompletedAt: true,
        createdAt: true,
        roles: { select: { role: { select: { name: true } } } },
        socialLinks: { select: { linkedin: true, github: true, twitter: true, website: true } },
        certifications: { select: { name: true, issueDate: true, expiryDate: true, verificationUrl: true } },
        profilePrivacy: { select: { bio: true, professionalExperience: true, socialLinks: true, certifications: true } },
      },
    });
    if (!user) return null;

    const [
      consents,
      skills,
      threads,
      replies,
      reports,
      guidelines,
      reputation,
      blogPosts,
      blogComments,
      resources,
      recordings,
      attempts,
      certificates,
      notifications,
      preferences,
      settings,
      preferenceChanges,
      files,
      sessions,
      requests,
      audit,
      resumes,
      resumeSuggestions,
      education,
      experience,
    ] = await Promise.all([
      this.prisma.consentRecord.findMany({ where: { userId }, orderBy: { seq: "asc" }, select: { purpose: true, action: true, policyVersion: true, source: true, createdAt: true } }),
      this.prisma.memberSkill.findMany({ where: { userId }, select: { visibility: true, createdAt: true, skill: { select: { name: true } } } }),
      this.prisma.forumThread.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, content: true, mode: true, createdAt: true, removedAt: true } }),
      this.prisma.forumReply.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, threadId: true, content: true, createdAt: true, editedAt: true, removedAt: true } }),
      this.prisma.forumReport.findMany({ where: { reporterId: userId }, orderBy: { createdAt: "asc" }, select: { reason: true, details: true, status: true, createdAt: true } }),
      this.prisma.forumGuidelineAcceptance.findMany({ where: { userId }, select: { version: true, acceptedAt: true } }),
      this.prisma.forumReputationEvent.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { kind: true, points: true, createdAt: true } }),
      this.prisma.blogPost.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, content: true, isPublished: true, postedAt: true } }),
      this.prisma.blogComment.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, blogPostId: true, content: true, createdAt: true } }),
      this.prisma.resource.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, description: true, resourceType: true, externalLink: true, createdAt: true } }),
      this.prisma.recording.findMany({ where: { instructorId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, description: true, recordedAt: true } }),
      this.prisma.quizAttempt.findMany({
        where: { userId },
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          startedAt: true,
          submittedAt: true,
          scorePct: true,
          passed: true,
          status: true,
          quiz: { select: { title: true } },
          answers: { select: { questionId: true, selectedOptionIds: true, isCorrect: true } },
        },
      }),
      this.prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: "asc" }, select: { certificateNumber: true, issuedAt: true, revokedAt: true, quiz: { select: { title: true } } } }),
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { type: true, payload: true, readAt: true, createdAt: true } }),
      this.prisma.notificationPreference.findMany({ where: { userId }, select: { eventType: true, channel: true, enabled: true } }),
      this.prisma.notificationSettings.findUnique({ where: { userId } }),
      this.prisma.notificationPreferenceChange.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { changes: true, createdAt: true } }),
      this.prisma.storedFile.findMany({ where: { ownerId: userId, kind: { not: "data_export" } }, orderBy: { createdAt: "asc" }, select: { kind: true, originalName: true, contentType: true, sizeBytes: true, status: true, createdAt: true } }),
      // Session records, without the token hash.
      this.prisma.refreshToken.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, expiresAt: true, revokedAt: true, userAgent: true, ipAddress: true } }),
      this.prisma.dataRequest.findMany({ where: { userId }, orderBy: { requestedAt: "asc" }, select: { kind: true, status: true, requestedAt: true, scheduledFor: true, completedAt: true, cancelledAt: true } }),
      // What staff and the system did to this account: action and time only (no staff notes).
      this.prisma.adminActivityLog.findMany({ where: { targetType: "user", targetId: userId }, orderBy: { createdAt: "asc" }, select: { action: true, createdAt: true } }),
      // Resumes (TASK-024): every stored version, the suggestions read from it and what was accepted.
      this.prisma.resume.findMany({
        where: { userId, status: { not: "awaiting_upload" } },
        orderBy: { version: "asc" },
        select: { id: true, version: true, status: true, activeSlot: true, failureCode: true, parsedAt: true, createdAt: true, file: { select: { originalName: true, contentType: true, sizeBytes: true, status: true, bucket: true, path: true } } },
      }),
      this.prisma.resumeSuggestion.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { resumeId: true, kind: true, data: true, status: true, decidedAt: true } }),
      this.prisma.memberEducation.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { institution: true, qualification: true, startYear: true, endYear: true, createdAt: true } }),
      this.prisma.memberExperience.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { title: true, company: true, startDate: true, endDate: true, current: true, createdAt: true } }),
    ]);

    // The resume files themselves (the member's own documents). One that cannot be read is listed
    // as not included rather than failing the whole export.
    const resumeFiles: { name: string; data: Buffer }[] = [];
    const resumeRows: unknown[] = [];
    for (const r of resumes) {
      const safe = r.file.originalName.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "").slice(0, 60) || "resume";
      const name = `resume/v${r.version}-${safe}`;
      let included = false;
      if (r.file.status === "available") {
        try {
          resumeFiles.push({ name, data: await this.storage.readHead(r.file.bucket, r.file.path, r.file.sizeBytes) });
          included = true;
        } catch {
          included = false;
        }
      }
      resumeRows.push({
        version: r.version,
        current: r.activeSlot === "current",
        status: r.status,
        failureCode: r.failureCode,
        originalName: r.file.originalName,
        contentType: r.file.contentType,
        sizeBytes: r.file.sizeBytes,
        uploadedAt: iso(r.createdAt),
        parsedAt: iso(r.parsedAt),
        fileInArchive: included ? name : null,
        suggestions: resumeSuggestions.filter((x) => x.resumeId === r.id).map((x) => ({ kind: x.kind, data: x.data, decision: x.status, decidedAt: iso(x.decidedAt) })),
      });
    }

    const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2), "utf8");
    const readme = [
      "PacketPulse data export",
      `Prepared: ${now.toISOString()}`,
      "",
      "This archive holds the personal data PacketPulse stores about you, as JSON files.",
      "account.json        your profile, roles, social links, self-entered certifications and who may see which profile field",
      "consents.json       every consent you gave or withdrew, with the policy version and time",
      "skills.json         skills on your profile",
      "community.json      forum threads and replies you wrote, reports you made, guidelines you accepted, reputation events",
      "content.json        blog posts and comments, resources and recordings you added",
      "learning.json       quiz attempts, answers and the certificates you earned",
      "notifications.json  notifications sent to you, your preferences, quiet hours and WhatsApp settings",
      "files.json          details of files you uploaded (names and sizes)",
      "resumes.json        every stored version of your resume, what was read from it and which suggestions you accepted or rejected",
      "resume/             the resume files themselves, one per stored version",
      "sessions.json       your sign-in sessions (time, device, IP address); tokens are never included",
      "requests.json       your data requests and what staff or the system did to your account",
      "",
      "Not included, on purpose: your password or its hash, session tokens, other people's data (including their",
      "replies in your threads), internal staff notes, and the audit log itself.",
      "",
    ].join("\n");

    return [
      { name: "README.txt", data: Buffer.from(readme, "utf8") },
      {
        name: "account.json",
        data: json({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          professionalExperience: user.professionalExperience,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
          ageConfirmedAt: iso(user.ageConfirmedAt),
          targetRole: user.targetRole,
          careerGoals: user.careerGoals,
          isApproved: user.isApproved,
          emailVerified: user.emailVerified,
          lastLoginAt: iso(user.lastLoginAt),
          onboardingCompletedAt: iso(user.onboardingCompletedAt),
          createdAt: iso(user.createdAt),
          roles: user.roles.map((r) => r.role.name),
          socialLinks: user.socialLinks,
          certifications: user.certifications.map((c) => ({ ...c, issueDate: iso(c.issueDate), expiryDate: iso(c.expiryDate) })),
          profileVisibility: user.profilePrivacy,
        }),
      },
      { name: "consents.json", data: json(consents) },
      { name: "skills.json", data: json(skills.map((s) => ({ skill: s.skill.name, visibility: s.visibility, addedAt: iso(s.createdAt) }))) },
      { name: "community.json", data: json({ threads, replies, reports, guidelineAcceptances: guidelines, reputationEvents: reputation }) },
      { name: "content.json", data: json({ blogPosts, blogComments, resources, recordings }) },
      {
        name: "learning.json",
        data: json({
          attempts: attempts.map((a) => ({ ...a, quiz: a.quiz.title })),
          certificates: certificates.map((c) => ({ ...c, quiz: c.quiz.title })),
        }),
      },
      {
        name: "notifications.json",
        data: json({
          notifications: notifications.map((n) => ({ ...n, payload: ownPayload(n.payload) })),
          preferences,
          settings: settings && {
            quietHoursEnabled: settings.quietHoursEnabled,
            quietHoursStart: settings.quietHoursStart,
            quietHoursEnd: settings.quietHoursEnd,
            timezone: settings.timezone,
            digestFrequency: settings.digestFrequency,
            marketingOptIn: settings.marketingOptIn,
            whatsappOptIn: settings.whatsappOptIn,
            whatsappNumber: settings.whatsappNumber,
          },
          preferenceChanges,
        }),
      },
      { name: "files.json", data: json(files) },
      { name: "resumes.json", data: json({ resumes: resumeRows, acceptedEducation: education.map((e) => ({ ...e, createdAt: iso(e.createdAt) })), acceptedExperience: experience.map((e) => ({ ...e, createdAt: iso(e.createdAt) })) }) },
      ...resumeFiles,
      { name: "sessions.json", data: json(sessions) },
      { name: "requests.json", data: json({ dataRequests: requests, accountHistory: audit }) },
    ];
  }
}
