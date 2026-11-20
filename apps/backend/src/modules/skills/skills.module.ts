import { Module } from "@nestjs/common";
import { AdminModule } from "../admin";
import { SkillsController } from "./presentation/controllers/skills.controller";
import { SkillsService } from "./application/services/skills.service";
import { SkillSuggestionsService } from "./application/services/skill-suggestions.service";
import { MemberSkillsService } from "./application/services/member-skills.service";

@Module({
  imports: [AdminModule],
  controllers: [SkillsController],
  providers: [SkillsService, SkillSuggestionsService, MemberSkillsService],
})
export class SkillsModule {}
