import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SkillLevel } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "../../../admin";
import { displayNameOf, matchKeyOf, nameKeyOf } from "../../domain/skill-keys";
import type { AddSkillAliasDto, CreateSkillDto, RetireSkillDto, UpdateSkillDto } from "../dto/skills.dto";

type Tx = Prisma.TransactionClient;

const skillInclude = {
  aliases: { select: { id: true, alias: true }, orderBy: { alias: "asc" as const } },
} satisfies Prisma.SkillInclude;

const PARENT_LEVEL: Record<SkillLevel, SkillLevel | null> = { major: null, minor: "major", micro: "minor" };

export function toSkillDto(s: Prisma.SkillGetPayload<{ include: typeof skillInclude }>) {
  return {
    id: s.id,
    name: s.name,
    level: s.level,
    parentId: s.parentId,
    description: s.description,
    position: s.position,
    status: s.status,
    aliases: s.aliases,
  };
}

// Admin-owned taxonomy (DEC-014). Every admin mutation runs in one transaction that also bumps
// the taxonomy version and writes the audit row, so the three can never disagree.
@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminActivityLogService,
  ) {}

  async taxonomy() {
    const [state, skills] = await Promise.all([
      this.prisma.skillTaxonomyState.findUnique({ where: { id: "default" } }),
      this.prisma.skill.findMany({
        where: { status: "active" },
        include: skillInclude,
        orderBy: [{ position: "asc" }, { name: "asc" }],
      }),
    ]);
    return { version: state?.version ?? 1, skills: skills.map(toSkillDto) };
  }

  /** Admin view: retired skills too, with how many members have each one. */
  async adminList() {
    const [state, skills, usage] = await Promise.all([
      this.prisma.skillTaxonomyState.findUnique({ where: { id: "default" } }),
      this.prisma.skill.findMany({ include: skillInclude, orderBy: [{ position: "asc" }, { name: "asc" }] }),
      this.prisma.memberSkill.groupBy({ by: ["skillId"], _count: { _all: true } }),
    ]);
    const counts = new Map(usage.map((u) => [u.skillId, u._count._all]));
    return {
      version: state?.version ?? 1,
      autoMergeThreshold: state?.autoMergeThreshold ?? 10,
      skills: skills.map((s) => ({ ...toSkillDto(s), memberCount: counts.get(s.id) ?? 0 })),
    };
  }

  async create(dto: CreateSkillDto, actorId: string) {
    return this.mutate(async (tx) => {
      const skill = await this.createInTx(tx, dto);
      const version = await this.bumpVersion(tx);
      await this.audit.log(
        actorId,
        "skill_created",
        "skill",
        skill.id,
        { name: skill.name, level: skill.level, parentId: skill.parentId, aliases: skill.aliases.map((a) => a.alias), taxonomyVersion: version },
        undefined,
        tx,
      );
      return toSkillDto(skill);
    });
  }

  async update(id: string, dto: UpdateSkillDto, actorId: string) {
    return this.mutate(async (tx) => {
      const existing = await tx.skill.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Skill not found");

      const data: Prisma.SkillUncheckedUpdateInput = {};
      if (dto.name !== undefined && nameKeyOf(dto.name) !== existing.nameKey) {
        await this.assertNameFree(tx, dto.name, { skillId: id });
        data.name = displayNameOf(dto.name);
        data.nameKey = nameKeyOf(dto.name);
        data.matchKey = matchKeyOf(dto.name);
      } else if (dto.name !== undefined) {
        data.name = displayNameOf(dto.name); // casing/spacing change only
      }
      if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
        if (existing.level === "major") throw new BadRequestException("A major skill has no parent");
        await this.assertParent(tx, existing.level, dto.parentId);
        data.parentId = dto.parentId;
      }
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.position !== undefined) data.position = dto.position;

      const updated = await tx.skill.update({ where: { id }, data, include: skillInclude });
      const version = await this.bumpVersion(tx);
      await this.audit.log(
        actorId,
        "skill_updated",
        "skill",
        id,
        {
          from: { name: existing.name, parentId: existing.parentId, description: existing.description, position: existing.position },
          to: { name: updated.name, parentId: updated.parentId, description: updated.description, position: updated.position },
          taxonomyVersion: version,
        },
        undefined,
        tx,
      );
      return toSkillDto(updated);
    });
  }

  // DB-006: retiring is blocked while the skill is in use — claimed by a member, or the parent
  // of a skill that is still active. Retire is the only way out (skills are never deleted).
  async retire(id: string, dto: RetireSkillDto, actorId: string) {
    return this.mutate(async (tx) => {
      const existing = await tx.skill.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Skill not found");
      if (existing.status === "retired") throw new ConflictException("Skill is already retired");

      const [members, children] = await Promise.all([
        tx.memberSkill.count({ where: { skillId: id } }),
        tx.skill.count({ where: { parentId: id, status: "active" } }),
      ]);
      if (members > 0 || children > 0) {
        throw new ConflictException(
          `Cannot retire "${existing.name}": ${members} member(s) have it selected and ${children} active child skill(s) sit under it.`,
        );
      }
      const updated = await tx.skill.update({
        where: { id },
        data: { status: "retired", retiredAt: new Date() },
        include: skillInclude,
      });
      const version = await this.bumpVersion(tx);
      await this.audit.log(actorId, "skill_retired", "skill", id, { name: existing.name, taxonomyVersion: version }, dto.reason, tx);
      return toSkillDto(updated);
    });
  }

  async restore(id: string, actorId: string) {
    return this.mutate(async (tx) => {
      const existing = await tx.skill.findUnique({ where: { id }, include: { parent: true } });
      if (!existing) throw new NotFoundException("Skill not found");
      if (existing.status === "active") throw new ConflictException("Skill is already active");
      if (existing.parent && existing.parent.status !== "active") {
        throw new ConflictException(`Restore its parent "${existing.parent.name}" first`);
      }
      const updated = await tx.skill.update({
        where: { id },
        data: { status: "active", retiredAt: null },
        include: skillInclude,
      });
      const version = await this.bumpVersion(tx);
      await this.audit.log(actorId, "skill_restored", "skill", id, { name: existing.name, taxonomyVersion: version }, undefined, tx);
      return toSkillDto(updated);
    });
  }

  async addAlias(skillId: string, dto: AddSkillAliasDto, actorId: string) {
    return this.mutate(async (tx) => {
      const skill = await tx.skill.findUnique({ where: { id: skillId } });
      if (!skill) throw new NotFoundException("Skill not found");
      await this.assertNameFree(tx, dto.alias);
      await tx.skillAlias.create({
        data: { skillId, alias: displayNameOf(dto.alias), aliasKey: nameKeyOf(dto.alias), matchKey: matchKeyOf(dto.alias) },
      });
      const version = await this.bumpVersion(tx);
      await this.audit.log(actorId, "skill_alias_added", "skill", skillId, { alias: displayNameOf(dto.alias), taxonomyVersion: version }, undefined, tx);
      return toSkillDto(await tx.skill.findUniqueOrThrow({ where: { id: skillId }, include: skillInclude }));
    });
  }

  async removeAlias(skillId: string, aliasId: string, actorId: string) {
    return this.mutate(async (tx) => {
      const alias = await tx.skillAlias.findFirst({ where: { id: aliasId, skillId } });
      if (!alias) throw new NotFoundException("Alias not found");
      await tx.skillAlias.delete({ where: { id: aliasId } });
      const version = await this.bumpVersion(tx);
      await this.audit.log(actorId, "skill_alias_removed", "skill", skillId, { alias: alias.alias, taxonomyVersion: version }, undefined, tx);
      return toSkillDto(await tx.skill.findUniqueOrThrow({ where: { id: skillId }, include: skillInclude }));
    });
  }

  // ---- building blocks shared with the suggestion queue ----------------------------------

  /** Creates a skill (and aliases) without bumping the version or auditing: the caller does both. */
  async createInTx(tx: Tx, dto: CreateSkillDto) {
    if (matchKeyOf(dto.name) === "") throw new BadRequestException("A skill name needs at least one letter or digit");
    await this.assertParent(tx, dto.level, dto.parentId);
    await this.assertNameFree(tx, dto.name);
    const aliasKeys = new Set<string>([nameKeyOf(dto.name)]);
    for (const alias of dto.aliases ?? []) {
      const key = nameKeyOf(alias);
      if (matchKeyOf(alias) === "") throw new BadRequestException("An alias needs at least one letter or digit");
      if (aliasKeys.has(key)) throw new ConflictException(`Alias "${alias}" repeats another name in this request`);
      aliasKeys.add(key);
      await this.assertNameFree(tx, alias);
    }
    const siblings = await tx.skill.aggregate({ where: { parentId: dto.parentId ?? null, level: dto.level }, _max: { position: true } });
    return tx.skill.create({
      data: {
        name: displayNameOf(dto.name),
        nameKey: nameKeyOf(dto.name),
        matchKey: matchKeyOf(dto.name),
        level: dto.level,
        parentId: dto.parentId ?? null,
        description: dto.description,
        position: (siblings._max.position ?? -1) + 1,
        aliases: {
          create: (dto.aliases ?? []).map((alias) => ({ alias: displayNameOf(alias), aliasKey: nameKeyOf(alias), matchKey: matchKeyOf(alias) })),
        },
      },
      include: skillInclude,
    });
  }

  async bumpVersion(tx: Tx): Promise<number> {
    const state = await tx.skillTaxonomyState.upsert({
      where: { id: "default" },
      update: { version: { increment: 1 } },
      create: { id: "default", version: 2 },
    });
    return state.version;
  }

  /** A name or alias may appear once across the whole taxonomy, ignoring case (DB-006). */
  async assertNameFree(tx: Tx, name: string, except: { skillId?: string } = {}) {
    const key = nameKeyOf(name);
    if (matchKeyOf(name) === "") throw new BadRequestException("A skill name needs at least one letter or digit");
    const [skill, alias] = await Promise.all([
      tx.skill.findUnique({ where: { nameKey: key } }),
      tx.skillAlias.findUnique({ where: { aliasKey: key } }),
    ]);
    if (skill && skill.id !== except.skillId) throw new ConflictException(`"${displayNameOf(name)}" is already a skill name`);
    if (alias) throw new ConflictException(`"${displayNameOf(name)}" is already an alias`);
  }

  private async assertParent(tx: Tx, level: SkillLevel, parentId?: string) {
    const wanted = PARENT_LEVEL[level];
    if (wanted === null) {
      if (parentId) throw new BadRequestException("A major skill has no parent");
      return;
    }
    if (!parentId) throw new BadRequestException(`A ${level} skill needs a ${wanted} parent`);
    const parent = await tx.skill.findUnique({ where: { id: parentId } });
    if (!parent) throw new BadRequestException("Parent skill not found");
    if (parent.level !== wanted) throw new BadRequestException(`The parent of a ${level} skill must be a ${wanted} skill`);
    if (parent.status !== "active") throw new BadRequestException("The parent skill is retired");
  }

  /** Runs `fn` in a transaction and turns a unique-name race into a 409 instead of a 500. */
  async mutate<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("That name is already used by another skill or alias");
      }
      throw e;
    }
  }
}
