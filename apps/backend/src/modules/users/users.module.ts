import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity";
import { NotificationsModule } from "../notifications";
import { UsersController } from "./presentation/controllers/users.controller";
import { UsersService } from "./application/services/users.service";

@Module({
  imports: [IdentityModule, NotificationsModule], // AuthCookieService + email-changed notice
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
