import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ResourcesService } from "../../application/services/resources.service";
import { CreateResourceDto, UpdateResourceDto, ResourceListQueryDto } from "../../application/dto/resources.dto";
import { Public, CurrentUser, RequirePermission, PERMISSIONS, SUPER_ADMIN_ROLE } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

function isAdminRoles(roles: string[]) {
  return roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
}

@Controller("resources")
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Public()
  @Get()
  list(@Query() query: ResourceListQueryDto, @CurrentUser() user?: AccessTokenPayload) {
    return this.resources.list(query, !!user && isAdminRoles(user.roles));
  }

  @Public()
  @Get(":id")
  getById(@Param("id") id: string, @CurrentUser() user?: AccessTokenPayload) {
    return this.resources.getById(id, !!user && isAdminRoles(user.roles));
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.RESOURCES_CREATE)
  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateResourceDto) {
    return this.resources.create(user.sub, user.roles, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Put(":id")
  update(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateResourceDto) {
    return this.resources.update(id, user.sub, user.roles, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Delete(":id")
  @HttpCode(200)
  async remove(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.resources.delete(id, user.sub, user.roles);
    return { success: true };
  }

  @Throttle(WRITE_STANDARD)
  @Put(":id/like")
  toggleLike(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.resources.toggleLike(id, user.sub);
  }

  @Throttle(WRITE_STANDARD)
  @Put(":id/download")
  incrementDownload(@Param("id") id: string) {
    return this.resources.incrementDownload(id);
  }
}
