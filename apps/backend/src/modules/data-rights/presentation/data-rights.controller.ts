import { Body, Controller, Delete, Get, HttpCode, Ip, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { DataRightsService } from "../application/data-rights.service";
import { DataExportService } from "../application/data-export.service";
import { AccountErasureService } from "../application/account-erasure.service";
import { AdminDataRequestListQueryDto, RequestErasureDto } from "../application/data-rights.dto";
import { AllowDeactivated, CurrentUser, PERMISSIONS, RequirePermission, SkipApproval, SkipEmailVerification } from "../../identity";
import type { AccessTokenPayload } from "../../identity";

// Writes are slow on purpose: a request is rare, and the password check in the erasure request
// must not become a way to guess passwords.
const WRITE = { default: { limit: 20, ttl: 3_600_000 } };

// Open to accounts that are not approved or verified yet (everybody with an account has these
// rights) and to a deactivated account (it must be able to see and cancel its own deletion and
// download an export before the grace period ends). Every route works on the caller's own data.
@AllowDeactivated()
@SkipApproval()
@SkipEmailVerification()
@Controller("data-rights")
export class DataRightsController {
  constructor(
    private readonly rights: DataRightsService,
    private readonly exports: DataExportService,
    private readonly erasure: AccountErasureService,
  ) {}

  @Get()
  overview(@CurrentUser() user: AccessTokenPayload) {
    return this.rights.overview(user.sub);
  }

  @Throttle(WRITE)
  @Post("export")
  requestExport(@CurrentUser() user: AccessTokenPayload) {
    return this.exports.request(user.sub);
  }

  // A fresh short-lived signed link to the member's own prepared export.
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("export/link")
  @HttpCode(200)
  exportLink(@CurrentUser() user: AccessTokenPayload, @Ip() ip: string) {
    return this.exports.link(user.sub, ip);
  }

  @Delete("export")
  discardExport(@CurrentUser() user: AccessTokenPayload) {
    return this.exports.discard(user.sub);
  }

  @Throttle(WRITE)
  @Post("erasure")
  requestErasure(@CurrentUser() user: AccessTokenPayload, @Body() dto: RequestErasureDto) {
    return this.erasure.request(user.sub, dto.password);
  }

  @Throttle(WRITE)
  @Delete("erasure")
  cancelErasure(@CurrentUser() user: AccessTokenPayload) {
    return this.erasure.cancel(user.sub);
  }
}

@Controller("admin/data-requests")
export class AdminDataRequestsController {
  constructor(private readonly rights: DataRightsService) {}

  // Read-only list of pending and finished requests with their audit entries.
  @RequirePermission(PERMISSIONS.ADMIN_VIEW_ANALYTICS)
  @Get()
  list(@Query() query: AdminDataRequestListQueryDto) {
    return this.rights.adminList(query);
  }
}
