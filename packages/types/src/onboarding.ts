import { z } from "zod";
import { ProfessionalExperienceSchema } from "./auth";
import { OptionalWhatsappNumberSchema } from "./whatsapp";

// Registration facts and onboarding (TASK-022, TASK-023; PRD-001, 003, 004, 006; API-001, API-006;
// TEST-001, TEST-003). One definition shared by the API and the web forms.

/** PRD-001: the email code length and lifetime. */
export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_CODE_TTL_MINUTES = 10;
/** PRD-001 (proposed limits): wrong guesses before the code locks, and the lock length. */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const EMAIL_CODE_LOCK_MINUTES = 15;
/** Wait before another code can be requested for the same address (default, not in the docs). */
export const EMAIL_CODE_RESEND_COOLDOWN_SECONDS = 60;
/** Most codes one address can be sent in an hour (default, not in the docs). */
export const EMAIL_CODE_MAX_SENDS_PER_HOUR = 5;

/** PRD-004 / OPEN-20. */
export const MINIMUM_AGE = 18;

// ---------------------------------------------------------------- Age (PRD-003, PRD-004)

/** Whole years between a YYYY-MM-DD date of birth and `today`, by calendar date (UTC). */
export function ageOn(dateOfBirth: string, today: Date = new Date()): number {
  const [y = 0, m = 0, d = 0] = dateOfBirth.split("-").map(Number);
  let age = today.getUTCFullYear() - y;
  const beforeBirthday = today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export const DateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth as YYYY-MM-DD")
  .superRefine((value, ctx) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a real date" });
      return;
    }
    const age = ageOn(value);
    if (age < 0 || age > 110) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a real date of birth" });
    else if (age < MINIMUM_AGE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `PacketPulse is for members aged ${MINIMUM_AGE} or older` });
    }
  });

// ---------------------------------------------------------------- Email code (PRD-001, API-002)

export const EmailCodeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email");

export const VerifyEmailCodeSchema = z.object({
  email: z.string().email(),
  code: EmailCodeSchema,
});
export type VerifyEmailCodeDto = z.infer<typeof VerifyEmailCodeSchema>;

export const ResendEmailCodeSchema = z.object({ email: z.string().email(), captchaToken: z.string().max(4096).optional() });
export type ResendEmailCodeDto = z.infer<typeof ResendEmailCodeSchema>;

// ---------------------------------------------------------------- Onboarding (PRD-003, API-006)

/** What PRD-003 needs from every member that the account itself does not already hold. */
export const ONBOARDING_ITEMS = ["professionalExperience", "dateOfBirth", "targetRole", "careerGoals", "skills"] as const;
export type OnboardingItem = (typeof ONBOARDING_ITEMS)[number];

export const ONBOARDING_ITEM_LABELS: Record<OnboardingItem, string> = {
  professionalExperience: "Experience level",
  dateOfBirth: "Date of birth",
  targetRole: "Current or target role",
  careerGoals: "Your goals",
  skills: "At least one skill",
};

/** Steps shown in the flow; only "contact" (WhatsApp) may be skipped because PRD-006 makes it optional. */
export const ONBOARDING_STEPS = ["about", "goals", "skills", "contact"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const TargetRoleSchema = z.string().trim().min(2, "Enter a role, e.g. Network Engineer").max(100);
export const CareerGoalsSchema = z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(1000);

/** Any subset can be saved, so the flow can be left and resumed; completeness is judged by the server. */
export const SaveOnboardingSchema = z.object({
  professionalExperience: ProfessionalExperienceSchema.optional(),
  dateOfBirth: DateOfBirthSchema.optional(),
  targetRole: TargetRoleSchema.optional(),
  careerGoals: CareerGoalsSchema.optional(),
  /** Blank clears the number (it is optional); anything else is normalised to E.164. */
  whatsappNumber: OptionalWhatsappNumberSchema,
});
export type SaveOnboardingDto = z.infer<typeof SaveOnboardingSchema>;

/** GET/PUT /onboarding: what is saved so far and what is still missing. */
export interface OnboardingStatus {
  complete: boolean;
  completedAt: string | null;
  /** Required items still missing, in the order the flow asks for them. */
  missing: OnboardingItem[];
  /** The first step with something missing; "contact" once the required items are in. */
  nextStep: OnboardingStep | null;
  values: {
    professionalExperience: z.infer<typeof ProfessionalExperienceSchema> | null;
    /** Own record only: date of birth is protected by the field policy (SEC-02). */
    dateOfBirth: string | null;
    targetRole: string | null;
    careerGoals: string | null;
    whatsappNumber: string | null;
    skillCount: number;
  };
}
