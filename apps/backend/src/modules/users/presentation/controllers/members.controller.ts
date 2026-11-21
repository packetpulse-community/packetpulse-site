import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { MembersService } from "../../application/services/members.service";
import { CurrentUser } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

@Controller("members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get(":userId")
  profile(@CurrentUser() viewer: AccessTokenPayload, @Param("userId", ParseUUIDPipe) userId: string) {
    return this.members.profile(viewer, userId);
  }
}
