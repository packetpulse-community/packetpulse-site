# 11 — Route inventory (TASK-008)

Generated from the live Nest router metadata (DiscoveryService, MetadataScanner and Reflector) by
`apps/backend/test/permission-matrix.e2e-spec.ts`, not written by hand. To regenerate:

```bash
cd apps/backend && ROUTE_INVENTORY_OUT=/tmp/routes.json env DATABASE_URL=postgresql://packetpulse:packetpulse@localhost:5433/packetpulse REDIS_URL=redis://localhost:6380 NODE_ENV=test PLATFORM_MODE=docker pnpm exec jest --config test/jest-e2e.json --runInBand --forceExit test/permission-matrix
```

The same test fails if a route has no declared access rule, if the set of `@Public` routes differs
from the reviewed list, or if a role holds permissions the plan does not give it.

## How access is decided

Global guards, in order (`app.module.ts`): `ThrottlerGuard`, `JwtAuthGuard` (401 unless `@Public`),
`MaintenanceGuard` (503 for non-admins while maintenance is on, unless `@AllowDuringMaintenance`),
`RolesGuard` (`@RequirePermission`, 403 `Missing required permission`; `super_admin` bypasses),
`ApprovedGuard` (403 unless approved and email-verified; admin and super_admin skip it;
`@SkipApproval` and `@SkipEmailVerification` opt out). `EmailVerifiedGuard` exists but is not applied
anywhere; `ApprovedGuard` already enforces email verification.

Role matrix (seed): member = blogs:create, resources:create, recordings:create, forums:create,
quizzes:attempt. moderator = *:moderate for blogs, resources, recordings, forums. instructor =
recordings:create, quizzes:author. admin = member + blogs:publish, all moderate, quizzes:author,
users:approve, users:manage-roles, admin:clean-data, admin:view-analytics, admin:manage-settings,
categories:manage. super_admin = everything (guard bypass).

Throttle tiers are per route and not listed here. "Maint." marks routes that still work during
maintenance mode.


## Public (no session needed) — 26 routes

| Route | Permission | Guards that apply | Maint. | Ownership / state rule in the service |
|---|---|---|---|---|
| `POST /api/auth/forgotpassword` |  | maintenance |  |  |
| `POST /api/auth/login` |  | — | yes |  |
| `POST /api/auth/refresh` |  | — | yes |  |
| `POST /api/auth/register` |  | maintenance |  |  |
| `POST /api/auth/register-admin` |  | maintenance |  | needs ADMIN_SECURE_CODE (secret in env) |
| `POST /api/auth/resend-email-code` |  | maintenance |  | same 200 for any address; 60 s cooldown and 5 per hour per address, bot check when enabled (TASK-022) |
| `POST /api/auth/resetpassword` |  | maintenance |  |  |
| `POST /api/auth/verify-email` |  | maintenance |  |  |
| `POST /api/auth/verify-email-code` |  | maintenance |  | 6-digit code, 10 min; same 400 for every failure; 5 misses lock the address 15 min (TASK-022) |
| `POST /api/auth/verifyotp` |  | maintenance |  |  |
| `GET /api/blogs` |  | maintenance |  | unapproved/unpublished posts only for admin |
| `GET /api/blogs/:id` |  | maintenance |  | unapproved/unpublished post only for its author or admin |
| `GET /api/blogs/featured` |  | maintenance |  |  |
| `GET /api/blogs/slug/:slug` |  | maintenance |  | unapproved/unpublished post only for its author or admin |
| `GET /api/categories` |  | maintenance |  |  |
| `GET /api/forums/categories` |  | maintenance |  |  |
| `GET /api/forums/threads` |  | maintenance |  |  |
| `GET /api/forums/threads/:id` |  | maintenance |  |  |
| `GET /api/health` |  | — | yes |  |
| `POST /api/logs` |  | maintenance |  | throttled 60/min; user id recorded when a token is present |
| `GET /api/quizzes` |  | maintenance |  | draft quizzes only for their author or admin |
| `GET /api/quizzes/:id` |  | maintenance |  | draft quiz is a 404 |
| `GET /api/quizzes/certificates/verify/:certificateNumber` |  | maintenance |  |  |
| `GET /api/recordings` |  | maintenance |  | unapproved recordings only for admin |
| `GET /api/recordings/:id` |  | maintenance |  | unapproved recording only for admin |
| `GET /api/site-status` |  | — | yes |  |

## Signed in, no specific permission — 37 routes

| Route | Permission | Guards that apply | Maint. | Ownership / state rule in the service |
|---|---|---|---|---|
| `POST /api/auth/logout` |  | JWT, maintenance, approved, email-verified | yes | own session |
| `GET /api/auth/me` |  | JWT, maintenance, approved, email-verified |  | own profile |
| `POST /api/auth/resend-verification` |  | JWT, maintenance, approved |  | own account; email-verification exempt |
| `GET /api/onboarding` |  | JWT, maintenance, approved, email-verified |  | own onboarding status only (own date of birth included) |
| `POST /api/onboarding/complete` |  | JWT, maintenance, approved, email-verified |  | own account; refused with the list of missing items |
| `PUT /api/onboarding` |  | JWT, maintenance, approved, email-verified |  | own details; date of birth must be 18 or older; blank WhatsApp clears it |
| `DELETE /api/blogs/:id` |  | JWT, maintenance, approved, email-verified |  | post author or admin |
| `PUT /api/blogs/:id` |  | JWT, maintenance, approved, email-verified |  | post author or admin |
| `POST /api/blogs/:id/comments` |  | JWT, maintenance, approved, email-verified |  | any member |
| `DELETE /api/blogs/:id/comments/:commentId` |  | JWT, maintenance, approved, email-verified |  | comment author or admin |
| `PUT /api/blogs/:id/like` |  | JWT, maintenance, approved, email-verified |  | any member |
| `GET /api/dashboard/stats` |  | JWT, maintenance, approved, email-verified |  | own stats |
| `PUT /api/forums/replies/:replyId/like` |  | JWT, maintenance, approved, email-verified |  | any member |
| `DELETE /api/forums/threads/:id` |  | JWT, maintenance, approved, email-verified |  | thread author or moderator |
| `PUT /api/forums/threads/:id` |  | JWT, maintenance, approved, email-verified |  | thread author or moderator |
| `DELETE /api/forums/threads/:id/replies/:replyId` |  | JWT, maintenance, approved, email-verified |  | reply author or moderator |
| `POST /api/network-tools/run` |  | JWT, maintenance, approved, email-verified |  | any member; simulated output only |
| `GET /api/notifications` |  | JWT, maintenance, approved, email-verified |  | own notifications only |
| `PUT /api/notifications/:id/read` |  | JWT, maintenance, approved, email-verified |  | own notification only |
| `GET /api/notifications/unread-count` |  | JWT, maintenance, approved, email-verified |  | own notifications only |
| `POST /api/quizzes/:id/attempts/:attemptId/submit` |  | JWT, maintenance, approved, email-verified |  | own attempt |
| `GET /api/quizzes/:id/attempts/mine` |  | JWT, maintenance, approved, email-verified |  | own attempts |
| `GET /api/quizzes/certificates/mine` |  | JWT, maintenance, approved, email-verified |  | own certificates |
| `DELETE /api/recordings/:id` |  | JWT, maintenance, approved, email-verified |  | recording owner or admin |
| `PUT /api/recordings/:id` |  | JWT, maintenance, approved, email-verified |  | recording owner or admin |
| `POST /api/recordings/:id/join` |  | JWT, maintenance, approved, email-verified |  | any member |
| `PUT /api/recordings/:id/like` |  | JWT, maintenance, approved, email-verified |  | any member |
| `GET /api/resources` |  | JWT, maintenance, approved, email-verified |  | approved resources; admin also sees pending |
| `DELETE /api/resources/:id` |  | JWT, maintenance, approved, email-verified |  | resource owner or admin |
| `GET /api/resources/:id` |  | JWT, maintenance, approved, email-verified |  | approved resource; admin also sees pending |
| `PUT /api/resources/:id` |  | JWT, maintenance, approved, email-verified |  | resource owner or admin |
| `PUT /api/resources/:id/download` |  | JWT, maintenance, approved, email-verified |  | any member |
| `PUT /api/resources/:id/like` |  | JWT, maintenance, approved, email-verified |  | any member |
| `DELETE /api/users/profile` |  | JWT, maintenance, approved, email-verified |  | own account; needs password |
| `GET /api/users/profile` |  | JWT, maintenance, approved, email-verified |  | own profile |
| `PUT /api/users/profile` |  | JWT, maintenance, approved, email-verified |  | own profile |
| `PUT /api/users/profile/password` |  | JWT, maintenance, approved, email-verified |  | own account; needs current password |

## Permission-gated — 44 routes

| Route | Permission | Guards that apply | Maint. | Ownership / state rule in the service |
|---|---|---|---|---|
| `GET /api/admin/activity` | `admin:view-analytics` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/analytics` | `admin:view-analytics` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/blogs/:id/approve` | `blogs:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/blogs/:id/unapprove` | `blogs:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/blogs/pending` | `blogs:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/recordings/:id/approve` | `recordings:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/recordings/:id/unapprove` | `recordings:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/recordings/pending` | `recordings:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/resources/:id/approve` | `resources:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/resources/:id/unapprove` | `resources:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/resources/pending` | `resources:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/settings` | `admin:manage-settings` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/settings` | `admin:manage-settings` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/stats` | `admin:view-analytics` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/status` | `admin:view-analytics` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/users` | `users:approve` | JWT, maintenance, roles, approved, email-verified |  |  |
| `DELETE /api/admin/users/:id` | `users:approve` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/users/:id` | `users:approve` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/users/:id/approve` | `users:approve` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/users/:id/clean-data` | `admin:clean-data` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/users/:id/roles` | `users:manage-roles` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/users/:id/unapprove` | `users:approve` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/admin/users/bulk-clean-data` | `admin:clean-data` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/admin/users/pending-approval` | `users:approve` | JWT, maintenance, roles, approved, email-verified |  |  |
| `POST /api/blogs` | `blogs:create` | JWT, maintenance, roles, approved, email-verified |  |  |
| `POST /api/categories` | `categories:manage` | JWT, maintenance, roles, approved, email-verified |  |  |
| `DELETE /api/categories/:id` | `categories:manage` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/categories/:id` | `categories:manage` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/categories/reorder` | `categories:manage` | JWT, maintenance, roles, approved, email-verified |  |  |
| `POST /api/forums/threads` | `forums:create` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/forums/threads/:id/lock` | `forums:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/forums/threads/:id/pin` | `forums:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `POST /api/forums/threads/:id/replies` | `forums:create` | JWT, maintenance, roles, approved, email-verified |  | thread must not be locked (reply to a locked thread is refused) |
| `PUT /api/forums/threads/:id/unlock` | `forums:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `PUT /api/forums/threads/:id/unpin` | `forums:moderate` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/logs` | `admin:view-analytics` | JWT, maintenance, roles, approved, email-verified |  |  |
| `POST /api/quizzes` | `quizzes:author` | JWT, maintenance, roles, approved, email-verified |  |  |
| `DELETE /api/quizzes/:id` | `quizzes:author` | JWT, maintenance, roles, approved, email-verified |  | quiz owner or admin |
| `PUT /api/quizzes/:id` | `quizzes:author` | JWT, maintenance, roles, approved, email-verified |  | quiz owner or admin |
| `POST /api/quizzes/:id/attempts` | `quizzes:attempt` | JWT, maintenance, roles, approved, email-verified |  |  |
| `GET /api/quizzes/:id/edit` | `quizzes:author` | JWT, maintenance, roles, approved, email-verified |  | quiz owner or admin |
| `GET /api/realtime/presence` | `admin:view-analytics` | JWT, maintenance, roles, approved, email-verified |  |  |
| `POST /api/recordings` | `recordings:create` | JWT, maintenance, roles, approved, email-verified |  |  |
| `POST /api/resources` | `resources:create` | JWT, maintenance, roles, approved, email-verified |  |  |

_Total: 102 routes._
