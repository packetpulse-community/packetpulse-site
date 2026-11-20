import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SkillVisibility } from "@prisma/client";
import { SELF_DECLARED_LABEL } from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { SetMemberSkillsDto } from "../dto/skills.dto";

const memberSkillInclude = { skill: true } satisfies Prisma.MemberSkillInclude;

function toMemberSkillDto(row: Prisma.MemberSkillGetPayload<{ include: typeof memberSkillInclude }>) {
  return {
    skillId: row.skillId,
    name: row.skill.name,
    level: row.skill.level,
    parentId: row.skill.parentId,
    visibility: row.visibility,
    // Self declared until the evidence model exists (PRD-012): never styled as verified.
    label: SELF_DECLARED_LABEL,
  };
}

@Injectable()
export class MemberSkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(userId: string) {
    const rows = await this.prisma.memberSkill.findMany({
      where: { userId },
      include: memberSkillInclude,
      orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
    });
    return rows.map(toMemberSkillDto);
  }

  // The member sends the whole selection; skills they already had keep their date. Only active
  // taxonomy skills can be picked (unknown names go through a suggestion instead).
  async setMine(userId: string, dto: SetMemberSkillsDto) {
    const ids = dto.skills.map((s) => s.skillId);
    const valid = await this.prisma.skill.findMany({ where: { id: { in: ids }, status: "active" }, select: { id: true } });
    const validIds = new Set(valid.map((s) => s.id));
    const unknown = ids.filter((id) => !validIds.has(id));
    if (unknown.length > 0) throw new BadRequestException(`Unknown or retired skill(s): ${unknown.join(", ")}`);

    await this.prisma.$transaction([
      this.prisma.memberSkill.deleteMany({ where: { userId, skillId: { notIn: ids } } }),
      ...dto.skills.map((s) =>
        this.prisma.memberSkill.upsert({
          where: { userId_skillId: { userId, skillId: s.skillId } },
          update: { visibility: s.visibility },
          create: { userId, skillId: s.skillId, visibility: s.visibility },
        }),
      ),
    ]);
    return this.mine(userId);
  }

  /**
   * Someone else's skills, filtered by the visibility the owner chose: the owner sees all;
   * other signed-in members see "public" and "members"; "private" never leaves the owner.
   */
  async forMember(viewerId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("Member not found");
    const visible: SkillVisibility[] = viewerId === userId ? ["public", "members", "private"] : ["public", "members"];
    const rows = await this.prisma.memberSkill.findMany({
      where: { userId, visibility: { in: visible }, skill: { status: "active" } },
      include: memberSkillInclude,
      orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
    });
    return rows.map(toMemberSkillDto);
  }
}
