import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SkillsService } from "../../application/services/skills.service";
import { SkillSuggestionsService } from "../../application/services/skill-suggestions.service";
import { MemberSkillsService } from "../../application/services/member-skills.service";
import {
  AddSkillAliasDto,
  AddSuggestionAsSkillDto,
  CreateSkillDto,
  MergeSuggestionDto,
  RejectSuggestionDto,
  RetireSkillDto,
  SetMemberSkillsDto,
  SkillSuggestionListQueryDto,
  SuggestSkillDto,
  UpdateSkillDto,
} from "../../application/dto/skills.dto";
import { CurrentUser, Public, RequirePermission, PERMISSIONS } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };
const SUGGEST = { default: { limit: 60, ttl: 3_600_000 } };

// Static segments ("mine", "suggestions", "members", "manage") are declared before ":id"
// routes so they are never read as an id.
@Controller("skills")
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly suggestions: SkillSuggestionsService,
    private readonly memberSkills: MemberSkillsService,
  ) {}

  // Public read API: the active taxonomy with aliases and its version.
  @Public()
  @Get()
  taxonomy() {
    return this.skills.taxonomy();
  }

  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Get("manage")
  adminList() {
    return this.skills.adminList();
  }

  // ---- member selection ------------------------------------------------------------------

  @Get("mine")
  mine(@CurrentUser() user: AccessTokenPayload) {
    return this.memberSkills.mine(user.sub);
  }

  @Throttle(WRITE_STANDARD)
  @Put("mine")
  setMine(@Body() dto: SetMemberSkillsDto, @CurrentUser() user: AccessTokenPayload) {
    return this.memberSkills.setMine(user.sub, dto);
  }

  @Get("members/:userId")
  forMember(@Param("userId") userId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.memberSkills.forMember(user.sub, userId);
  }

  // ---- suggestion queue ------------------------------------------------------------------

  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Get("suggestions")
  listSuggestions(@Query() query: SkillSuggestionListQueryDto) {
    return this.suggestions.list(query.status);
  }

  @Throttle(SUGGEST)
  @Post("suggestions")
  suggest(@Body() dto: SuggestSkillDto, @CurrentUser() user: AccessTokenPayload) {
    return this.suggestions.suggest(user.sub, dto.name);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Put("suggestions/:id/add")
  addSuggestion(@Param("id") id: string, @Body() dto: AddSuggestionAsSkillDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.suggestions.addAsSkill(id, dto, admin.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Put("suggestions/:id/merge")
  mergeSuggestion(@Param("id") id: string, @Body() dto: MergeSuggestionDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.suggestions.merge(id, dto.skillId, admin.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Put("suggestions/:id/reject")
  rejectSuggestion(@Param("id") id: string, @Body() dto: RejectSuggestionDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.suggestions.reject(id, dto, admin.sub);
  }

  // ---- taxonomy management ---------------------------------------------------------------

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Post()
  create(@Body() dto: CreateSkillDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.skills.create(dto, admin.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSkillDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.skills.update(id, dto, admin.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Put(":id/retire")
  retire(@Param("id") id: string, @Body() dto: RetireSkillDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.skills.retire(id, dto, admin.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Put(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.skills.restore(id, admin.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Post(":id/aliases")
  addAlias(@Param("id") id: string, @Body() dto: AddSkillAliasDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.skills.addAlias(id, dto, admin.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.SKILLS_MANAGE)
  @Delete(":id/aliases/:aliasId")
  @HttpCode(200)
  removeAlias(@Param("id") id: string, @Param("aliasId") aliasId: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.skills.removeAlias(id, aliasId, admin.sub);
  }
}
