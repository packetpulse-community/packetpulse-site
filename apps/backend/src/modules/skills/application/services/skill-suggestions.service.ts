import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SkillSuggestion } from "@prisma/client";
import { MAX_NEW_SUGGESTIONS_PER_DAY } from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "../../../admin";
import { displayNameOf, matchKeyOf, nameKeyOf } from "../../domain/skill-keys";
import { SkillsService, toSkillDto } from "./skills.service";
import type { AddSuggestionAsSkillDto, RejectSuggestionDto } from "../dto/skills.dto";

type Tx = Prisma.TransactionClient;

export function toSuggestionDto(s: SkillSuggestion) {
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    sightings: s.sightings,
    matchSkillId: s.matchSkillId,
    resolvedSkillId: s.resolvedSkillId,
    rejectReason: s.rejectReason,
    createdAt: s.createdAt.toISOString(),
  };
}

// PRD-011: unknown skills enter a queue; each distinct member who types the same name is one
// sighting; admins add, merge or reject; a clear match (same letters and digits as an
// existing skill or alias) merges by itself once it has enough sightings (default 10).
@Injectable()
export class SkillSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminActivityLogService,
    private readonly skills: SkillsService,
  ) {}

  async list(status: SkillSuggestion["status"] = "pending") {
    const rows = await this.prisma.skillSuggestion.findMany({
      where: { status },
      orderBy: [{ sightings: "desc" }, { createdAt: "asc" }],
      take: 200,
    });
    return rows.map(toSuggestionDto);
  }

  /** A member reports a skill missing from the taxonomy. */
  async suggest(userId: string, rawName: string) {
    const name = displayNameOf(rawName);
    const key = nameKeyOf(rawName);
    const matchKey = matchKeyOf(rawName);
    if (matchKey === "") throw new BadRequestException("A skill name needs at least one letter or digit");

    return this.skills.mutate(async (tx) => {
      const [skill, alias] = await Promise.all([
        tx.skill.findUnique({ where: { nameKey: key } }),
        tx.skillAlias.findUnique({ where: { aliasKey: key }, include: { skill: true } }),
      ]);
      const existing = skill ?? alias?.skill;
      if (existing) return { outcome: "exists" as const, skillId: existing.id, suggestion: null };

      let suggestion = await tx.skillSuggestion.findUnique({ where: { nameKey: key } });
      if (suggestion) {
        if (suggestion.status === "rejected") throw new ConflictException("This suggestion was reviewed and declined");
        if (suggestion.status !== "pending") {
          return { outcome: "exists" as const, skillId: suggestion.resolvedSkillId, suggestion: toSuggestionDto(suggestion) };
        }
        const seen = await tx.skillSuggestionSighting.findUnique({ where: { suggestionId_userId: { suggestionId: suggestion.id, userId } } });
        if (seen) return { outcome: "already_counted" as const, skillId: null, suggestion: toSuggestionDto(suggestion) };
        await tx.skillSuggestionSighting.create({ data: { suggestionId: suggestion.id, userId } });
        suggestion = await tx.skillSuggestion.update({ where: { id: suggestion.id }, data: { sightings: { increment: 1 } } });
        suggestion = await this.autoMergeIfReady(tx, suggestion);
        return { outcome: "counted" as const, skillId: suggestion.resolvedSkillId, suggestion: toSuggestionDto(suggestion) };
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await tx.skillSuggestion.count({ where: { suggestedById: userId, createdAt: { gte: since } } });
      if (recent >= MAX_NEW_SUGGESTIONS_PER_DAY) {
        throw new ConflictException(`You can suggest at most ${MAX_NEW_SUGGESTIONS_PER_DAY} new skills a day`);
      }
      const match = await this.findClearMatch(tx, matchKey);
      suggestion = await tx.skillSuggestion.create({
        data: { name, nameKey: key, matchKey, matchSkillId: match, suggestedById: userId, sightings: 1, sightingRows: { create: { userId } } },
      });
      suggestion = await this.autoMergeIfReady(tx, suggestion);
      return { outcome: "created" as const, skillId: suggestion.resolvedSkillId, suggestion: toSuggestionDto(suggestion) };
    });
  }

  /** Admin: turn a suggestion into a real skill (optionally renamed). */
  async addAsSkill(id: string, dto: AddSuggestionAsSkillDto, actorId: string) {
    return this.skills.mutate(async (tx) => {
      const suggestion = await this.pendingOrThrow(tx, id);
      const skill = await this.skills.createInTx(tx, { name: dto.name ?? suggestion.name, level: dto.level, parentId: dto.parentId });
      const updated = await tx.skillSuggestion.update({
        where: { id },
        data: { status: "added", resolvedSkillId: skill.id, resolvedAt: new Date() },
      });
      const version = await this.skills.bumpVersion(tx);
      await this.audit.log(
        actorId,
        "skill_suggestion_added",
        "skill_suggestion",
        id,
        { suggestion: suggestion.name, sightings: suggestion.sightings, skillId: skill.id, skillName: skill.name, level: skill.level, taxonomyVersion: version },
        undefined,
        tx,
      );
      return { suggestion: toSuggestionDto(updated), skill: toSkillDto(skill) };
    });
  }

  /** Admin: the suggested name is another way to write an existing skill, so it becomes an alias. */
  async merge(id: string, skillId: string, actorId: string) {
    return this.skills.mutate(async (tx) => {
      const suggestion = await this.pendingOrThrow(tx, id);
      const updated = await this.mergeInto(tx, suggestion, skillId);
      const version = await this.skills.bumpVersion(tx);
      await this.audit.log(
        actorId,
        "skill_suggestion_merged",
        "skill_suggestion",
        id,
        { suggestion: suggestion.name, sightings: suggestion.sightings, skillId, taxonomyVersion: version },
        undefined,
        tx,
      );
      return toSuggestionDto(updated);
    });
  }

  async reject(id: string, dto: RejectSuggestionDto, actorId: string) {
    return this.skills.mutate(async (tx) => {
      const suggestion = await this.pendingOrThrow(tx, id);
      const updated = await tx.skillSuggestion.update({
        where: { id },
        data: { status: "rejected", rejectReason: dto.reason, resolvedAt: new Date() },
      });
      await this.audit.log(
        actorId,
        "skill_suggestion_rejected",
        "skill_suggestion",
        id,
        { suggestion: suggestion.name, sightings: suggestion.sightings },
        dto.reason,
        tx,
      );
      return toSuggestionDto(updated);
    });
  }

  // ---- internals -------------------------------------------------------------------------

  private async pendingOrThrow(tx: Tx, id: string) {
    const suggestion = await tx.skillSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException("Suggestion not found");
    if (suggestion.status !== "pending") throw new ConflictException("This suggestion has already been handled");
    return suggestion;
  }

  /** An active skill or alias that differs from the suggestion only in case, spacing or punctuation. */
  private async findClearMatch(tx: Tx, matchKey: string): Promise<string | null> {
    const skill = await tx.skill.findFirst({ where: { matchKey, status: "active" }, select: { id: true } });
    if (skill) return skill.id;
    const alias = await tx.skillAlias.findFirst({ where: { matchKey, skill: { status: "active" } }, select: { skillId: true } });
    return alias?.skillId ?? null;
  }

  private async mergeInto(tx: Tx, suggestion: SkillSuggestion, skillId: string) {
    const skill = await tx.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException("Skill not found");
    if (skill.status !== "active") throw new BadRequestException("Cannot merge into a retired skill");
    await this.skills.assertNameFree(tx, suggestion.name);
    await tx.skillAlias.create({
      data: { skillId, alias: suggestion.name, aliasKey: suggestion.nameKey, matchKey: suggestion.matchKey },
    });
    return tx.skillSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "merged", resolvedSkillId: skillId, matchSkillId: skillId, resolvedAt: new Date() },
    });
  }

  // Runs after every new sighting. Re-checks the match now (the taxonomy may have changed
  // since the suggestion was opened) and merges once distinct sightings reach the threshold.
  private async autoMergeIfReady(tx: Tx, suggestion: SkillSuggestion): Promise<SkillSuggestion> {
    const state = await tx.skillTaxonomyState.findUnique({ where: { id: "default" } });
    const threshold = state?.autoMergeThreshold ?? 10;
    const match = await this.findClearMatch(tx, suggestion.matchKey);
    if (match !== suggestion.matchSkillId) {
      suggestion = await tx.skillSuggestion.update({ where: { id: suggestion.id }, data: { matchSkillId: match } });
    }
    if (!match || suggestion.sightings < threshold) return suggestion;

    const merged = await this.mergeInto(tx, suggestion, match);
    const version = await this.skills.bumpVersion(tx);
    await this.audit.log(
      null,
      "skill_suggestion_auto_merged",
      "skill_suggestion",
      suggestion.id,
      { suggestion: suggestion.name, sightings: suggestion.sightings, threshold, skillId: match, taxonomyVersion: version },
      `Reached ${suggestion.sightings} sightings (threshold ${threshold}) and matches an existing skill`,
      tx,
    );
    return merged;
  }
}
