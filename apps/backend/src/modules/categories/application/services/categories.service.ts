import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { categorySelect } from "../../domain/entities/category.entity";
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from "../dto/categories.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ select: categorySelect, orderBy: { position: "asc" } });
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException("A category with this slug already exists");

    const maxPosition = await this.prisma.category.aggregate({ _max: { position: true } });
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        position: (maxPosition._max.position ?? -1) + 1,
      },
      select: categorySelect,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");

    if (dto.slug && dto.slug !== existing.slug) {
      const slugTaken = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
      if (slugTaken) throw new ConflictException("A category with this slug already exists");
    }

    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, slug: dto.slug, description: dto.description },
      select: categorySelect,
    });
  }

  // Hard-blocks deletion while any content still references the category —
  // simplest and safest for a small (~7 row) admin-managed list; reassigning
  // content to a different category before deleting is a manual step for now.
  async delete(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { blogPosts: true, resources: true, recordings: true, quizzes: true, threads: true } },
      },
    });
    if (!existing) throw new NotFoundException("Category not found");

    const inUseCount = Object.values(existing._count).reduce((sum, n) => sum + n, 0);
    if (inUseCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${existing.name}" — it's still used by ${inUseCount} item(s). Reassign them to a different category first.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
  }

  async reorder(dto: ReorderCategoriesDto) {
    const categories = await this.prisma.category.findMany({ select: { id: true } });
    const knownIds = new Set(categories.map((c) => c.id));
    const providedIds = new Set(dto.orderedIds);
    if (knownIds.size !== providedIds.size || [...knownIds].some((id) => !providedIds.has(id))) {
      throw new BadRequestException("orderedIds must include every existing category exactly once");
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, position) => this.prisma.category.update({ where: { id }, data: { position } })),
    );
    return this.list();
  }
}
