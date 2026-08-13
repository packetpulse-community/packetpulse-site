// Plain-text templates — kept intentionally simple (no HTML/MJML pipeline) since the
// goal here is real delivery of the six touchpoints the old app never had (plan §4),
// not visual polish.
export type EmailTemplate =
  | { name: "verification"; token: string }
  | { name: "welcome"; firstName: string }
  | { name: "password-reset-otp"; otp: string }
  | { name: "approval"; approved: boolean }
  | { name: "role-change"; roleNames: string[] }
  | { name: "password-changed" }
  | { name: "suspicious-refresh-reuse" };

export function renderEmail(template: EmailTemplate): { subject: string; text: string } {
  switch (template.name) {
    case "verification":
      return {
        subject: "Verify your PacketPulse email",
        text: `Verify your email using this token: ${template.token} (expires in 24h).`,
      };
    case "welcome":
      return {
        subject: "Welcome to PacketPulse",
        text: `Hi ${template.firstName}, your email is verified. Once an admin approves your account you'll have full access.`,
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
    case "password-changed":
      return {
        subject: "Your PacketPulse password was changed",
        text: "Your password was just changed. If this wasn't you, reset your password immediately and contact support.",
      };
    case "suspicious-refresh-reuse":
      return {
        subject: "Security alert: PacketPulse session revoked",
        text: "We detected reuse of an invalidated session token on your account and revoked all active sessions as a precaution. If this wasn't expected, change your password.",
      };
  }
}
