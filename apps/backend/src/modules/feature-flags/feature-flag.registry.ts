import type { FeatureFlagKey } from "@packetpulse/types";
import { PERMISSIONS } from "../identity/domain/constants/permissions.constants";

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  /** Shown on the admin page; says what turning it off does. */
  description: string;
  /** Value when nobody has changed it. Every default keeps today's behaviour. */
  defaultValue: boolean;
  /** Permission needed to change it (super_admin always passes). */
  changePermission: string;
  /** Returned by the public endpoint so the web app can hide or explain the feature. */
  public: boolean;
  /**
   * When set, the value lives in that existing SiteSettings column instead of the override
   * store, so the older Settings screen and this page can never disagree.
   */
  siteSetting?: "registrationEnabled";
}

// The registry is the only list of switches: an unknown key is rejected by the admin API, and
// the guard decorator is typed against FeatureFlagKey, so a switch cannot exist unregistered.
export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  {
    key: "registration.open",
    description: "Anyone can create a new account. When off, sign-up is refused; existing members are not affected.",
    defaultValue: true,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: true,
    siteSetting: "registrationEnabled",
  },
  {
    key: "forums.posting",
    description: "Members can start forum threads and reply. When off, forums stay readable but nobody can post.",
    defaultValue: true,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: true,
  },
  {
    key: "quizzes.attempts",
    description: "Members can start quiz attempts. When off, quizzes and past results stay visible but no new attempt can begin.",
    defaultValue: true,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: true,
  },
  {
    key: "resources.uploads",
    description: "Members can submit new resources. When off, the resource library stays readable.",
    defaultValue: true,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: true,
  },
  {
    key: "files.uploads",
    description: "File uploads (resource files, images). When off, no new upload can be started or completed.",
    defaultValue: true,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: true,
  },
  {
    key: "blogs.comments",
    description: "Members can comment on blog posts. When off, existing comments stay visible.",
    defaultValue: true,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: true,
  },
  {
    key: "notifications.email",
    description:
      "Notification emails are sent. When off, non-critical emails are skipped (recorded as feature_off); security and other critical emails still go out. In-app notifications are unaffected.",
    defaultValue: true,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: false,
  },
  {
    key: "onboarding.instant_access",
    description:
      "DEC-035 switch. Off (default): a new member waits for admin approval, and the email code is sent when an admin approves. On: the email code is sent at sign-up and a member who verifies it is approved at once.",
    defaultValue: false,
    changePermission: PERMISSIONS.ADMIN_MANAGE_SETTINGS,
    public: false,
  },
];

export const FLAG_BY_KEY = new Map(FEATURE_FLAGS.map((f) => [f.key, f] as const));
