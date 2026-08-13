import { createZodDto } from "nestjs-zod";
import { CreateBlogPostSchema, UpdateBlogPostSchema, CreateCommentSchema, BlogListQuerySchema } from "@packetpulse/types";

export class CreateBlogPostDto extends createZodDto(CreateBlogPostSchema) {}
export class UpdateBlogPostDto extends createZodDto(UpdateBlogPostSchema) {}
export class CreateCommentDto extends createZodDto(CreateCommentSchema) {}
export class BlogListQueryDto extends createZodDto(BlogListQuerySchema) {}
