import { Prisma } from "@prisma/client";

export const blogPostDetailInclude = Prisma.validator<Prisma.BlogPostInclude>()({
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  tags: true,
  images: true,
  comments: {
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  },
  _count: { select: { likes: true, comments: true } },
});

export type BlogPostDetail = Prisma.BlogPostGetPayload<{ include: typeof blogPostDetailInclude }>;

export const blogPostSummaryInclude = Prisma.validator<Prisma.BlogPostInclude>()({
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  tags: true,
  _count: { select: { likes: true, comments: true } },
});

export type BlogPostSummary = Prisma.BlogPostGetPayload<{ include: typeof blogPostSummaryInclude }>;
