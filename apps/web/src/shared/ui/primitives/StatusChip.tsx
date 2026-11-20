import { AlertCircle, Check, Info, X, type LucideIcon } from "lucide-react";
import { cva } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/shared/utils/cn";

// Status chips (Document 2 sections 4.3, 8, 9): ALWAYS a visible text label plus a
// glyph, so status is never conveyed by colour alone. Needs a [data-theme="grove"]
// ancestor for its colours.

export type StatusTone = "success" | "warning" | "danger" | "information" | "neutral";

const TONE_GLYPH: Record<StatusTone, LucideIcon> = {
  success: Check,
  warning: AlertCircle, // exclamation
  danger: X, // cross
  information: Info,
  neutral: Info,
};

const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-grove-pill px-2.5 py-0.5 text-xs font-semibold leading-5",
  {
    variants: {
      tone: {
        success: "bg-state-success-soft text-state-success",
        warning: "bg-state-warning-soft text-state-warning",
        danger: "bg-state-danger-soft text-state-danger",
        information: "bg-state-information-soft text-state-information",
        neutral: "bg-grove-subtle text-grove-text-secondary",
        // module-coloured tones, used only by verification labels
        community: "bg-module-community-soft text-module-community",
        recruitment: "bg-module-recruitment-soft text-module-recruitment",
        learning: "bg-module-learning-soft text-module-learning",
      },
    },
  },
);

type ChipTone = StatusTone | "community" | "recruitment" | "learning";

interface ChipBaseProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: ChipTone;
  glyph: LucideIcon;
}

const ChipBase = forwardRef<HTMLSpanElement, ChipBaseProps>(
  ({ tone, glyph: Glyph, className, children, ...props }, ref) => (
    <span ref={ref} className={cn(chipVariants({ tone }), className)} {...props}>
      <Glyph aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
      <span>{children}</span>
    </span>
  ),
);
ChipBase.displayName = "ChipBase";

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** The visible text. Required content: a chip without words is not allowed. */
  children: React.ReactNode;
}

export const StatusChip = forwardRef<HTMLSpanElement, StatusChipProps>(({ tone, ...props }, ref) => (
  <ChipBase ref={ref} tone={tone} glyph={TONE_GLYPH[tone]} {...props} />
));
StatusChip.displayName = "StatusChip";

// ---- Verification labels (Document 2 section 4.3) -------------------------------

export const VERIFICATION_LABELS = {
  "self-declared": { text: "Self declared", tone: "neutral", glyph: Info },
  "assessment-verified": { text: "Assessment verified", tone: "community", glyph: Check },
  "pp-verified": { text: "PP verified", tone: "community", glyph: Check },
  "experience-verified": { text: "Experience verified", tone: "recruitment", glyph: Check },
  "certification-verified": { text: "Certification verified", tone: "learning", glyph: Check },
  pending: { text: "Verification pending", tone: "warning", glyph: AlertCircle },
  unsuccessful: { text: "Verification unsuccessful", tone: "danger", glyph: X },
} as const satisfies Record<string, { text: string; tone: ChipTone; glyph: LucideIcon }>;

export type VerificationLabel = keyof typeof VERIFICATION_LABELS;

export interface VerificationChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: VerificationLabel;
}

export const VerificationChip = forwardRef<HTMLSpanElement, VerificationChipProps>(({ label, ...props }, ref) => {
  const def = VERIFICATION_LABELS[label];
  return (
    <ChipBase ref={ref} tone={def.tone} glyph={def.glyph} {...props}>
      {def.text}
    </ChipBase>
  );
});
VerificationChip.displayName = "VerificationChip";
