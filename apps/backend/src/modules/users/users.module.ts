import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity";
import { NotificationsModule } from "../notifications";
import { DataRightsModule } from "../data-rights";
import { UsersController } from "./presentation/controllers/users.controller";
import { MembersController } from "./presentation/controllers/members.controller";
import { MembersService } from "./application/services/members.service";
import { ProfilePrivacyService } from "./application/services/profile-privacy.service";
import { UsersService } from "./application/services/users.service";

@Module({
  imports: [IdentityModule, NotificationsModule, DataRightsModule], // AuthCookieService + email-changed notice
  controllers: [UsersController, MembersController],
  providers: [UsersService, MembersService, ProfilePrivacyService],
})
export class UsersModule {}
