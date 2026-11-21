// Plain-text templates — kept intentionally simple (no HTML/MJML pipeline) since the
// goal here is real delivery of the six touchpoints the old app never had (plan §4),
// not visual polish.
export type EmailTemplate =
  | { name: "verification"; link: string; code?: string }
  | { name: "approved-verify"; link: string; code?: string }
  | { name: "email-code"; code: string }
  | { name: "welcome"; firstName: string; loginLink: string }
  | { name: "password-reset-otp"; otp: string }
  | { name: "approval"; approved: boolean }
  | { name: "role-change"; roleNames: string[] }
  | { name: "password-changed" }
  | { name: "new-content"; kind: "blog" | "resource"; title: string; link: string }
  | { name: "suspicious-refresh-reuse" }
  // Generic event notice (TASK-021): says THAT something happened, never WHAT. No titles, names,
  // resume, compensation or notes: the details are behind sign-in at `link`.
  | { name: "event-notice"; eventType: string; link: string; settingsLink: string };

// Subject per event type. Fixed strings on purpose (PRD-041 privacy rule: nothing private in a subject).
const EVENT_SUBJECTS: Record<string, string> = {
  forum_reply: "New reply to your PacketPulse thread",
  forum_answer_accepted: "Your answer was accepted on PacketPulse",
  forum_post_removed: "A moderator removed your PacketPulse post",
  blog_comment: "New comment on your PacketPulse post",
  approval: "An update on your PacketPulse account",
  role_change: "Your PacketPulse roles changed",
  certificate_issued: "Your PacketPulse certificate is ready",
  security_alert: "Security alert on your PacketPulse account",
  interview: "An update on your interview",
  offer: "An update on your offer",
  assessment_result: "Your assessment result is ready",
  badge_expiry: "A PacketPulse badge is about to expire",
  billing: "A PacketPulse billing notice",
};

export function renderEmail(template: EmailTemplate): { subject: string; text: string } {
  switch (template.name) {
    case "verification":
      return {
        subject: "Verify your PacketPulse email",
        text: `${template.code ? `Your PacketPulse verification code is ${template.code}. It expires in 10 minutes.\n\nOr verify by` : "Verify your email by"} clicking this link: ${template.link} (the link expires in 24h).`,
      };
    case "approved-verify":
      return {
        subject: "Your PacketPulse account is approved — verify your email",
        text: `Good news — an admin has approved your PacketPulse account.\n\n${template.code ? `To activate it, enter this code on the sign-in page: ${template.code}\nThe code expires in 10 minutes.\n\nOr verify your email address by opening this link:\n` : "To activate it, verify your email address by opening this link:\n"}${template.link}\n\nThe link expires in 24 hours. If either expires, just sign in and we'll send you a fresh one.`,
      };
    case "email-code":
      return {
        subject: "Your PacketPulse verification code",
        text: `Your PacketPulse verification code is ${template.code}.\n\nIt expires in 10 minutes. If you did not create an account, ignore this email.`,
      };
    case "welcome":
      return {
        subject: "Welcome to PacketPulse",
        text: `Hi ${template.firstName}, your email is verified and your account is now active.\n\nSign in here: ${template.loginLink}`,
      };
    case "password-reset-otp":
      return {
        subject: "Your PacketPulse password reset code",
        text: `Your OTP is ${template.otp}. It expires in 10 minutes.`,
      };
    case "approval":
      return {
        subject: template.approved ? "Your PacketPulse account is approved" : "Your PacketPulse account access was revoked",
        text: template.approved
          ? "An admin has approved your account. You now have full access."
          : "An admin has revoked your account's approval.",
      };
    case "role-change":
      return {
        subject: "Your PacketPulse roles changed",
        text: `Your account roles are now: ${template.roleNames.join(", ")}.`,
      };
    case "new-content": {
      const noun = template.kind === "blog" ? "blog post" : "resource";
      return {
        subject: `New on PacketPulse: ${template.title}`,
        text: `A new ${noun} was just published on PacketPulse:\n\n${template.title}\n${template.link}\n\nYou're receiving this because you're a member of PacketPulse.`,
      };
    }
    case "password-changed":
      return {
        subject: "Your PacketPulse password was changed",
        text: "Your PacketPulse password was changed successfully, and all other signed-in sessions were signed out.\n\nIf this wasn't you, reset your password immediately and contact an admin.",
      };
    case "event-notice":
      return {
        subject: EVENT_SUBJECTS[template.eventType] ?? "You have a new PacketPulse notification",
        text: `You have a new notification on PacketPulse. Sign in to read it:\n${template.link}\n\nYou can choose which emails you get, and set quiet hours, here:\n${template.settingsLink}`,
      };
    case "suspicious-refresh-reuse":
      return {
        subject: "Security alert: PacketPulse session revoked",
        text: "We detected reuse of an invalidated session token on your account and revoked all active sessions as a precaution. If this wasn't expected, change your password.",
      };
  }
}
