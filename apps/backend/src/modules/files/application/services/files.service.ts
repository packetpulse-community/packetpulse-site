import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileAccessAction, StoredFile } from "@prisma/client";
import { extname } from "path";
import { randomUUID } from "crypto";
import { CreateUploadUrlDto, FILE_LINK_TTL_SECONDS, FileKind } from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { StorageProvider } from "../../../../common/storage/storage-provider";
import { FileScanner, ScannerUnavailableError } from "../../domain/file-scanner";
import { canOpen } from "../../domain/file-policy";

// Resume files (TASK-024) are created, completed and deleted only through the resume module, which
// checks consent, keeps one current version and starts parsing. The generic routes refuse them.
const RESUME_VIA_RESUMES = "Resumes are uploaded from the resume page.";

type Actor = { sub: string; roles: string[] };

const UPLOAD_URL_TTL_SECONDS = 300;
const HEAD_BYTES = 16;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly scanner: FileScanner,
    private readonly config: ConfigService,
  ) {}

  private get bucket() {
    return this.config.get<string>("STORAGE_PRIVATE_BUCKET") ?? "private-files";
  }

  // Append-only: rows are only ever inserted.
  private log(fileId: string, actorId: string, action: FileAccessAction, ip?: string) {
    return this.prisma.fileAccessLog.create({ data: { fileId, actorId, action, ip: ip ?? null } });
  }

  private view(f: StoredFile) {
    return {
      id: f.id,
      kind: f.kind,
      originalName: f.originalName,
      contentType: f.contentType,
      sizeBytes: f.sizeBytes,
      status: f.status,
      createdAt: f.createdAt,
    };
  }

  // A file that is missing, deleted or not the caller's looks identical (404), and a refused
  // attempt is logged as `denied`.
  private async loadFor(id: string, user: Actor, ip: string | undefined, ownerOnly: boolean, viaResumes = true) {
    const file = await this.prisma.storedFile.findUnique({ where: { id } });
    // Data exports (TASK-046) are handed out only by the data-rights module, which logs and
    // audits each link; this endpoint pretends they do not exist.
    if (!file || file.kind === "data_export") throw new NotFoundException("File not found");
    const allowed = ownerOnly ? file.ownerId === user.sub : canOpen(user, file, await this.accessContext(user, file));
    if (!allowed || file.status === "deleted") {
      if (!allowed) await this.log(file.id, user.sub, "denied", ip);
      throw new NotFoundException("File not found");
    }
    if (file.kind === "resume" && !viaResumes) throw new BadRequestException(RESUME_VIA_RESUMES);
    return file;
  }

  // What canOpen needs beyond the file row. Only a resume opened by someone other than its owner
  // needs anything: staff may read it only after the member agreed to share it (resume_sharing)
  // and only once it is no longer being checked (the parse job can still reject unsafe content).
  private async accessContext(user: Actor, file: StoredFile) {
    if (file.kind !== "resume" || file.ownerId === user.sub) return undefined;
    const [consent, resume] = await Promise.all([
      this.prisma.consentRecord.findFirst({ where: { userId: file.ownerId, purpose: "resume_sharing" }, orderBy: [{ createdAt: "desc" }, { seq: "desc" }], select: { action: true } }),
      this.prisma.resume.findUnique({ where: { fileId: file.id }, select: { status: true } }),
    ]);
    return { resumeSharingGranted: consent?.action === "granted", resumeSettled: resume?.status === "ready" || resume?.status === "failed" };
  }

  async createUploadUrl(user: Actor, dto: CreateUploadUrlDto, ip?: string, viaResumes = false) {
    if (dto.kind === "resume" && !viaResumes) throw new BadRequestException(RESUME_VIA_RESUMES);
    const id = randomUUID();
    const ext = extname(dto.originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
    // Never derived from the user's file name beyond a sanitised extension.
    const path = `${user.sub}/${id}${ext}`;
    const file = await this.prisma.storedFile.create({
      data: {
        id,
        ownerId: user.sub,
        kind: dto.kind,
        originalName: dto.originalName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        bucket: this.bucket,
        path,
      },
    });
    const { url } = await this.storage.createSignedUploadUrl(file.bucket, file.path, UPLOAD_URL_TTL_SECONDS);
    await this.log(file.id, user.sub, "upload_url", ip);
    return { file: this.view(file), uploadUrl: url, expiresInSeconds: UPLOAD_URL_TTL_SECONDS, method: "PUT" as const };
  }

  async complete(user: Actor, id: string, ip?: string, viaResumes = false) {
    const file = await this.loadFor(id, user, ip, true, viaResumes);
    if (file.status !== "pending") return { file: this.view(file) }; // idempotent
    const head = await this.storage.headObject(file.bucket, file.path);
    if (!head.exists) throw new BadRequestException("No file has been uploaded for this id yet");

    let verdict = { clean: true, reason: "" };
    if (head.size !== file.sizeBytes) {
      verdict = { clean: false, reason: `size ${head.size} does not match declared ${file.sizeBytes}` };
    } else {
      const bytes = await this.storage.readHead(file.bucket, file.path, HEAD_BYTES);
      try {
        verdict = await this.scanner.scan({
          bucket: file.bucket,
          path: file.path,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          kind: file.kind as FileKind, // data_export never reaches here: loadFor hides it
          head: bytes,
          readAll: () => this.storage.readHead(file.bucket, file.path, file.sizeBytes),
        });
      } catch (e) {
        // Fail closed: no verdict means no access. The upload stays pending (not rejected,
        // not deleted), so the caller can retry once the scanner is back.
        if (e instanceof ScannerUnavailableError) {
          throw new ServiceUnavailableException("The file could not be scanned right now. Please try again shortly.");
        }
        throw e;
      }
    }
    if (!verdict.clean) await this.storage.delete(file.bucket, file.path);
    const updated = await this.prisma.storedFile.update({
      where: { id: file.id },
      data: { status: verdict.clean ? "available" : "rejected", scanResult: verdict.reason },
    });
    await this.log(file.id, user.sub, "complete", ip);
    if (!verdict.clean) throw new BadRequestException(`File rejected: ${verdict.reason}`);
    return { file: this.view(updated) };
  }

  async link(user: Actor, id: string, ip?: string) {
    const file = await this.loadFor(id, user, ip, false);
    if (file.status !== "available") throw new NotFoundException("File not found");
    const { url } = await this.storage.createSignedDownloadUrl(file.bucket, file.path, FILE_LINK_TTL_SECONDS);
    await this.log(file.id, user.sub, "open", ip);
    return { url, expiresInSeconds: FILE_LINK_TTL_SECONDS, originalName: file.originalName, contentType: file.contentType };
  }

  async remove(user: Actor, id: string, ip?: string, viaResumes = false) {
    const file = await this.loadFor(id, user, ip, false, viaResumes);
    await this.storage.delete(file.bucket, file.path);
    await this.prisma.storedFile.update({ where: { id: file.id }, data: { status: "deleted" } });
    await this.log(file.id, user.sub, "delete", ip);
    return { success: true };
  }
}
