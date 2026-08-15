import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminUsersService } from "../../application/services/admin-users.service";
import { AdminCleanDataService } from "../../application/services/admin-clean-data.service";
import { AdminModerationService } from "../../application/services/admin-moderation.service";
import { AdminAnalyticsService } from "../../application/services/admin-analytics.service";
import { AdminActivityLogService } from "../../application/services/admin-activity-log.service";
import {
  AssignRolesDto,
  CleanDataDto,
  BulkCleanDataDto,
  AdminUserListQueryDto,
  AdminDateRangeQueryDto,
  AdminActivityListQueryDto,
} from "../../application/dto/admin.dto";
import { CurrentUser, RequirePermission, PERMISSIONS } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

// admin tier (plan §4): generous but not unbounded for high-trust callers.
const ADMIN_TIER = { default: { limit: 500, ttl: 3_600_000 } };

@Controller("admin")
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly cleanData: AdminCleanDataService,
    private readonly moderation: AdminModerationService,
    private readonly analytics: AdminAnalyticsService,
    private readonly activityLog: AdminActivityLogService,
  ) {}

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.USERS_APPROVE)
  @Get("users")
  listUsers(@Query() query: AdminUserListQueryDto) {
    return this.users.list(query);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.USERS_APPROVE)
  @Get("users/pending-approval")
  pendingApproval() {
    return this.users.pendingApproval();
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.USERS_APPROVE)
  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.users.getById(id);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.USERS_APPROVE)
  @Put("users/:id/approve")
  approve(@Param("id") id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.users.setApproval(id, admin.sub, true);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.USERS_APPROVE)
  @Put("users/:id/unapprove")
  unapprove(@Param("id") id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.users.setApproval(id, admin.sub, false);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.USERS_MANAGE_ROLES)
  @Put("users/:id/roles")
  assignRoles(@Param("id") id: string, @Body() dto: AssignRolesDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.users.assignRoles(id, dto, admin.sub);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.USERS_APPROVE)
  @Delete("users/:id")
  @HttpCode(200)
  async deleteUser(@Param("id") id: string, @CurrentUser() admin: AccessTokenPayload) {
    await this.users.delete(id, admin.sub);
    return { success: true };
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.ADMIN_CLEAN_DATA)
  @Put("users/:id/clean-data")
  cleanUserData(@Param("id") id: string, @Body() dto: CleanDataDto) {
    return this.cleanData.cleanUser(id, dto.dataType);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.ADMIN_CLEAN_DATA)
  @Put("users/bulk-clean-data")
  bulkCleanData(@Body() dto: BulkCleanDataDto) {
    return this.cleanData.cleanBulk(dto.userIds, dto.dataType);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.RESOURCES_MODERATE)
  @Get("resources/pending")
  pendingResources() {
    return this.moderation.pendingResources();
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.RESOURCES_MODERATE)
  @Put("resources/:id/approve")
  approveResource(@Param("id") id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.moderation.approveResource(id, admin.sub);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.RECORDINGS_MODERATE)
  @Get("recordings/pending")
  pendingRecordings() {
    return this.moderation.pendingRecordings();
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.RECORDINGS_MODERATE)
  @Put("recordings/:id/approve")
  approveRecording(@Param("id") id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.moderation.approveRecording(id, admin.sub);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.BLOGS_MODERATE)
  @Get("blogs/pending")
  pendingBlogs() {
    return this.moderation.pendingBlogs();
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.BLOGS_MODERATE)
  @Put("blogs/:id/approve")
  approveBlog(@Param("id") id: string, @CurrentUser() admin: AccessTokenPayload) {
    return this.moderation.approveBlog(id, admin.sub);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.ADMIN_VIEW_ANALYTICS)
  @Get("stats")
  stats(@Query() query: AdminDateRangeQueryDto) {
    return this.analytics.stats(query);
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.ADMIN_VIEW_ANALYTICS)
  @Get("analytics")
  async analyticsSummary(@Query() query: AdminDateRangeQueryDto) {
    const [registrationTrend, roleDistribution, activityDistribution] = await Promise.all([
      this.analytics.registrationTrend(query),
      this.analytics.roleDistribution(),
      this.analytics.activityDistribution(),
    ]);
    return { registrationTrend, roleDistribution, activityDistribution };
  }

  @Throttle(ADMIN_TIER)
  @RequirePermission(PERMISSIONS.ADMIN_VIEW_ANALYTICS)
  @Get("activity")
  activity(@Query() query: AdminActivityListQueryDto) {
    return this.activityLog.list(query);
  }
}
