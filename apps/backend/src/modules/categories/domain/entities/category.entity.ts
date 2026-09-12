import { Prisma } from "@prisma/client";

export const categorySelect = Prisma.validator<Prisma.CategorySelect>()({
  id: true,
  name: true,
  slug: true,
  description: true,
  position: true,
});

export type CategoryEntity = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
