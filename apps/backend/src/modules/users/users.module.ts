import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity";
import { UsersController } from "./presentation/controllers/users.controller";
import { UsersService } from "./application/services/users.service";

@Module({
  imports: [IdentityModule], // for AuthCookieService (clearing cookies on account delete)
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
