import { z } from "zod";
import { PaginationQuerySchema } from "./common";

export const ResourceTypeSchema = z.enum([
  "pdf",
  "video",
  "article",
  "tutorial",
  "diagram",
  "config_template",
  "tool",
  "external_link",
]);

export const CreateBlogPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  categoryId: z.string().uuid(),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
});
export type CreateBlogPostDto = z.infer<typeof CreateBlogPostSchema>;

export const UpdateBlogPostSchema = CreateBlogPostSchema.partial();
export type UpdateBlogPostDto = z.infer<typeof UpdateBlogPostSchema>;

export const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

export const BlogListQuerySchema = PaginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});
export type BlogListQuery = z.infer<typeof BlogListQuerySchema>;

export const CreateResourceSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    resourceType: ResourceTypeSchema,
    categoryId: z.string().uuid(),
    fileUrl: z.string().url().optional(),
    externalLink: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    downloadable: z.boolean().default(true),
    premium: z.boolean().default(false),
    tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  })
  .refine((v) => v.fileUrl || v.externalLink, {
    message: "Either fileUrl or externalLink is required",
    path: ["fileUrl"],
  });
export type CreateResourceDto = z.infer<typeof CreateResourceSchema>;

export const UpdateResourceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  resourceType: ResourceTypeSchema.optional(),
  categoryId: z.string().uuid().optional(),
  fileUrl: z.string().url().optional(),
  externalLink: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  downloadable: z.boolean().optional(),
  premium: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});
export type UpdateResourceDto = z.infer<typeof UpdateResourceSchema>;

export const ResourceListQuerySchema = PaginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  resourceType: ResourceTypeSchema.optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});
export type ResourceListQuery = z.infer<typeof ResourceListQuerySchema>;

export const CreateRecordingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  recordingUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.coerce.number().int().min(0).default(0),
  categoryId: z.string().uuid(),
  premium: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
});
export type CreateRecordingDto = z.infer<typeof CreateRecordingSchema>;

export const UpdateRecordingSchema = CreateRecordingSchema.partial().omit({ recordingUrl: true }).extend({
  recordingUrl: z.string().url().optional(),
});
export type UpdateRecordingDto = z.infer<typeof UpdateRecordingSchema>;

export const RecordingListQuerySchema = PaginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});
export type RecordingListQuery = z.infer<typeof RecordingListQuerySchema>;
