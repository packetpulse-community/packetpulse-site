"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  CareerGoalsSchema,
  DateOfBirthSchema,
  MINIMUM_AGE,
  ONBOARDING_ITEM_LABELS,
  ONBOARDING_STEPS,
  OptionalWhatsappNumberSchema,
  ProfessionalExperienceSchema,
  TargetRoleSchema,
  type MemberSkill,
  type OnboardingItem,
  type OnboardingStatus,
  type OnboardingStep,
  type Skill,
} from "@packetpulse/types";
import { SkillPicker } from "@/features/skills/components/SkillPicker";
import { applyServerFormError } from "@/shared/api/form-errors";
import { ApiError } from "@/shared/api/http-client";
import { safeNext } from "@/shared/auth/safe-next";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { onboardingClientApi, onboardingKeys } from "../api/onboarding.api";

const inputClass = "w-full rounded-grove-control border border-input bg-background px-3 py-2.5";

const EXPERIENCE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "junior", label: "Junior (0–2 years)" },
  { value: "mid", label: "Mid-level (3–5 years)" },
  { value: "senior", label: "Senior (5–10 years)" },
  { value: "lead", label: "Lead / Principal (10+ years)" },
] as const;

const STEP_TITLE: Record<OnboardingStep, string> = {
  about: "About you",
  goals: "Your role and goals",
  skills: "Your skills",
  contact: "Contact (optional)",
};
const STEP_OF_ITEM: Record<OnboardingItem, OnboardingStep> = {
  professionalExperience: "about",
  dateOfBirth: "about",
  targetRole: "goals",
  careerGoals: "goals",
  skills: "skills",
};

const AboutSchema = z.object({
  professionalExperience: ProfessionalExperienceSchema,
  dateOfBirth: z.string().min(1, "Enter your date of birth").pipe(DateOfBirthSchema),
});
const GoalsSchema = z.object({ targetRole: TargetRoleSchema, careerGoals: CareerGoalsSchema });
const ContactSchema = z.object({ whatsappNumber: OptionalWhatsappNumberSchema });

/** The latest date of birth that still makes someone 18 today, for the date input's max. */
function latestAdultBirthDate(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - MINIMUM_AGE);
  return d.toISOString().slice(0, 10);
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
const describedBy = (id: string, hint: boolean, error?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

interface Props {
  initial: OnboardingStatus;
  taxonomy: Skill[];
  initialSkills: MemberSkill[];
  /** ?next= from the URL, sanitised again here before use. */
  next?: string | null;
}

// TASK-023 / PRD-003: collect the required details one short step at a time. Every step is saved
// as it is finished, so leaving and coming back resumes at the first step with something missing.
// Only the contact step can be skipped (WhatsApp is optional, PRD-006); everything else is needed
// before the member area opens, and the server lists what is missing if "Finish" is pressed early.
export function OnboardingFlow({ initial, taxonomy, initialSkills, next }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: onboardingKeys.status, queryFn: onboardingClientApi.status, initialData: initial, staleTime: 0 });
  const data = status.data;
  const [step, setStep] = useState<OnboardingStep>(initial.nextStep ?? "about");
  const [finishError, setFinishError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const index = ONBOARDING_STEPS.indexOf(step);
  const goto = (s: OnboardingStep) => {
    setFinishError("");
    setStep(s);
  };
  const advance = () => goto(ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)]!);
  const refresh = (s: OnboardingStatus) => qc.setQueryData(onboardingKeys.status, s);

  const complete = useMutation({
    mutationFn: onboardingClientApi.complete,
    onSuccess: (s) => {
      refresh(s);
      router.push(safeNext(next));
      router.refresh();
    },
    onError: (err) => {
      const body = err instanceof ApiError ? (err.body as { message?: string; missing?: OnboardingItem[] } | null) : null;
      setFinishError(body?.message ?? "We could not finish. Please try again.");
      const firstMissing = body?.missing?.[0];
      if (firstMissing) goto(STEP_OF_ITEM[firstMissing]);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-sm text-muted-foreground">
          Step {index + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {STEP_TITLE[step]}
        </h1>
      </div>

      <ol className="flex items-center justify-center gap-2" aria-label="Progress">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined} className="flex items-center">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium",
                s === step ? "border-primary bg-primary text-primary-foreground" : i < index ? "border-primary text-primary-text" : "border-border text-muted-foreground",
              )}
            >
              <span aria-hidden="true">{i + 1}</span>
              <span className="sr-only">{`${STEP_TITLE[s]}${s === step ? ", current step" : i < index ? ", done" : ""}`}</span>
            </span>
          </li>
        ))}
      </ol>

      {data.missing.length > 0 && step === "contact" && (
        <p role="alert" className="rounded-grove-control border border-border bg-surface-subtle px-4 py-3 text-sm">
          Still needed: {data.missing.map((m) => ONBOARDING_ITEM_LABELS[m]).join(", ")}.
        </p>
      )}

      {step === "about" && <AboutStep data={data} onSaved={(s) => { refresh(s); advance(); }} />}
      {step === "goals" && <GoalsStep data={data} onBack={() => goto("about")} onSaved={(s) => { refresh(s); advance(); }} />}
      {step === "skills" && (
        <SkillsStep
          data={data}
          taxonomy={taxonomy}
          initialSkills={initialSkills}
          onBack={() => goto("goals")}
          onSkillsSaved={() => void status.refetch()}
          onContinue={advance}
        />
      )}
      {step === "contact" && (
        <ContactStep
          data={data}
          busy={complete.isPending}
          onBack={() => goto("skills")}
          onSaved={(s) => {
            refresh(s);
            complete.mutate();
          }}
          onSkip={() => complete.mutate()}
        />
      )}
      {finishError && (
        <p role="alert" className="text-sm text-destructive">
          {finishError}
        </p>
      )}
    </div>
  );
}

function StepButtons({ onBack, submitLabel, pending, extra }: { onBack?: () => void; submitLabel: string; pending: boolean; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row-reverse">
      <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: "gradient" }), "w-full sm:w-auto")}>
        {pending ? "Saving…" : submitLabel}
      </button>
      {extra}
      {onBack && (
        <button type="button" onClick={onBack} disabled={pending} className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:mr-auto sm:w-auto")}>
          Back
        </button>
      )}
    </div>
  );
}

function AboutStep({ data, onSaved }: { data: OnboardingStatus; onSaved: (s: OnboardingStatus) => void }) {
  const form = useForm<z.input<typeof AboutSchema>>({
    resolver: zodResolver(AboutSchema),
    defaultValues: { professionalExperience: data.values.professionalExperience ?? undefined, dateOfBirth: data.values.dateOfBirth ?? "" },
  });
  const { register, handleSubmit, setError, formState: { errors } } = form;
  const save = useMutation({
    mutationFn: onboardingClientApi.save,
    onSuccess: onSaved,
    onError: (err) => applyServerFormError(setError, err, ["professionalExperience", "dateOfBirth"], "We could not save this step"),
  });
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="flex flex-col gap-4">
      <Field id="professionalExperience" label="Experience level" error={errors.professionalExperience?.message ? "Choose your experience level" : undefined}>
        <select
          id="professionalExperience"
          className={inputClass}
          aria-invalid={errors.professionalExperience ? true : undefined}
          aria-describedby={describedBy("professionalExperience", false, errors.professionalExperience?.message)}
          {...register("professionalExperience")}
        >
          <option value="">Select your experience level</option>
          {EXPERIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="dateOfBirth"
        label="Date of birth"
        hint={`You must be ${MINIMUM_AGE} or older. Only you and PacketPulse staff can see this; it is never shown to companies.`}
        error={errors.dateOfBirth?.message}
      >
        <input
          id="dateOfBirth"
          type="date"
          max={latestAdultBirthDate()}
          autoComplete="bday"
          className={inputClass}
          aria-invalid={errors.dateOfBirth ? true : undefined}
          aria-describedby={describedBy("dateOfBirth", true, errors.dateOfBirth?.message)}
          {...register("dateOfBirth")}
        />
      </Field>
      {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
      <StepButtons submitLabel="Continue" pending={save.isPending} />
    </form>
  );
}

function GoalsStep({ data, onBack, onSaved }: { data: OnboardingStatus; onBack: () => void; onSaved: (s: OnboardingStatus) => void }) {
  const form = useForm<z.input<typeof GoalsSchema>>({
    resolver: zodResolver(GoalsSchema),
    defaultValues: { targetRole: data.values.targetRole ?? "", careerGoals: data.values.careerGoals ?? "" },
  });
  const { register, handleSubmit, setError, formState: { errors } } = form;
  const save = useMutation({
    mutationFn: onboardingClientApi.save,
    onSuccess: onSaved,
    onError: (err) => applyServerFormError(setError, err, ["targetRole", "careerGoals"], "We could not save this step"),
  });
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="flex flex-col gap-4">
      <Field id="targetRole" label="Current or target role" hint="For example Network Engineer or NOC Analyst." error={errors.targetRole?.message}>
        <input
          id="targetRole"
          className={inputClass}
          aria-invalid={errors.targetRole ? true : undefined}
          aria-describedby={describedBy("targetRole", true, errors.targetRole?.message)}
          {...register("targetRole")}
        />
      </Field>
      <Field id="careerGoals" label="What do you want to achieve?" hint="A sentence or two is enough." error={errors.careerGoals?.message}>
        <textarea
          id="careerGoals"
          rows={4}
          className={inputClass}
          aria-invalid={errors.careerGoals ? true : undefined}
          aria-describedby={describedBy("careerGoals", true, errors.careerGoals?.message)}
          {...register("careerGoals")}
        />
      </Field>
      {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
      <StepButtons onBack={onBack} submitLabel="Continue" pending={save.isPending} />
    </form>
  );
}

function SkillsStep({
  data,
  taxonomy,
  initialSkills,
  onBack,
  onSkillsSaved,
  onContinue,
}: {
  data: OnboardingStatus;
  taxonomy: Skill[];
  initialSkills: MemberSkill[];
  onBack: () => void;
  onSkillsSaved: () => void;
  onContinue: () => void;
}) {
  const hasSkill = data.values.skillCount > 0;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Pick at least one skill and press Save skills. They are shown as self declared until you add evidence.
      </p>
      <h2 className="sr-only">Choose your skills</h2>
      <SkillPicker taxonomy={taxonomy} initial={initialSkills} onSaved={onSkillsSaved} />
      <p role="status" className={cn("text-sm", hasSkill ? "text-success" : "text-muted-foreground")}>
        {hasSkill ? `${data.values.skillCount} skill${data.values.skillCount === 1 ? "" : "s"} saved.` : "No skill saved yet."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button type="button" onClick={onContinue} disabled={!hasSkill} className={cn(buttonVariants({ variant: "gradient" }), "w-full sm:w-auto")}>
          Continue
        </button>
        <button type="button" onClick={onBack} className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:mr-auto sm:w-auto")}>
          Back
        </button>
      </div>
    </div>
  );
}

function ContactStep({
  data,
  busy,
  onBack,
  onSaved,
  onSkip,
}: {
  data: OnboardingStatus;
  busy: boolean;
  onBack: () => void;
  onSaved: (s: OnboardingStatus) => void;
  onSkip: () => void;
}) {
  const form = useForm<z.input<typeof ContactSchema>>({
    resolver: zodResolver(ContactSchema),
    defaultValues: { whatsappNumber: data.values.whatsappNumber ?? "" },
  });
  const { register, handleSubmit, setError, formState: { errors } } = form;
  const save = useMutation({
    mutationFn: onboardingClientApi.save,
    onSuccess: onSaved,
    onError: (err) => applyServerFormError(setError, err, ["whatsappNumber"], "We could not save your number"),
  });
  return (
    <form onSubmit={handleSubmit((v) => save.mutate({ whatsappNumber: v.whatsappNumber ?? "" }))} noValidate className="flex flex-col gap-4">
      <Field
        id="whatsappNumber"
        label="WhatsApp number"
        hint="Optional. A 10-digit Indian mobile number, or include your country code. You can add it later in your profile."
        error={errors.whatsappNumber?.message}
      >
        <input
          id="whatsappNumber"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          className={inputClass}
          aria-invalid={errors.whatsappNumber ? true : undefined}
          aria-describedby={describedBy("whatsappNumber", true, errors.whatsappNumber?.message)}
          {...register("whatsappNumber")}
        />
      </Field>
      {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
      <StepButtons
        onBack={onBack}
        submitLabel="Finish"
        pending={save.isPending || busy}
        extra={
          <button type="button" onClick={onSkip} disabled={save.isPending || busy} className={cn(buttonVariants({ variant: "ghost" }), "w-full sm:w-auto")}>
            Skip for now
          </button>
        }
      />
    </form>
  );
}
