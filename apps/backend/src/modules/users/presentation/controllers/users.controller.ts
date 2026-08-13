import { Body, Controller, Delete, Get, HttpCode, Put, Res } from "@nestjs/common";
import { Response } from "express";
import { UsersService } from "../../application/services/users.service";
import { UpdateProfileDto, ChangePasswordDto, DeleteAccountDto } from "../../application/dto/users.dto";
import { CurrentUser } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";
import { AuthCookieService } from "../../../identity/application/services/auth-cookie.service";

@Controller("users/profile")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Get()
  async getProfile(@CurrentUser() current: AccessTokenPayload) {
    return this.users.getProfile(current.sub);
  }

  @Put()
  async updateProfile(@CurrentUser() current: AccessTokenPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(current.sub, dto);
  }

  @Put("password")
  @HttpCode(200)
  async changePassword(@CurrentUser() current: AccessTokenPayload, @Body() dto: ChangePasswordDto) {
    await this.users.changePassword(current.sub, dto);
    return { success: true };
  }

  @Delete()
  @HttpCode(200)
  async deleteAccount(
    @CurrentUser() current: AccessTokenPayload,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.users.deleteAccount(current.sub, dto.password);
    this.cookies.clearAuthCookies(res);
    return { success: true };
  }
}
