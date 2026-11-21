import { z } from "zod";

// TASK-014 / SEC-03 / PRD-046: private files (resumes, certificates, evidence).
// Upload flow for a client: POST /files/upload-url -> PUT the bytes to the returned signed
// URL (storage directly, never our server) -> POST /files/:id/complete.

export const FILE_MAX_BYTES = 5 * 1024 * 1024;

export const FileKindSchema = z.enum(["resume", "certificate", "evidence"]);
export type FileKind = z.infer<typeof FileKindSchema>;

export const FileStatusSchema = z.enum(["pending", "available", "rejected", "deleted"]);
export type FileStatus = z.infer<typeof FileStatusSchema>;

// Allowed content types per kind. Resumes: PDF and DOCX (TASK-024: legacy DOC is not accepted).
// Certificates and evidence: PDF and images.
export const FILE_CONTENT_TYPES: Record<FileKind, readonly string[]> = {
  resume: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  certificate: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  evidence: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
};

export const CreateUploadUrlSchema = z
  .object({
    kind: FileKindSchema,
    originalName: z.string().trim().min(1).max(200),
    contentType: z.string().trim().min(1).max(150),
    sizeBytes: z.number().int().positive().max(FILE_MAX_BYTES),
  })
  .superRefine((v, ctx) => {
    if (!FILE_CONTENT_TYPES[v.kind].includes(v.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentType"],
        message: `${v.contentType} is not allowed for ${v.kind}`,
      });
    }
  });
export type CreateUploadUrlDto = z.infer<typeof CreateUploadUrlSchema>;

export const FILE_LINK_TTL_SECONDS = 60;
