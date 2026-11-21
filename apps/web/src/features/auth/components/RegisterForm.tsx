"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { RegisterSchema } from "@packetpulse/types";
import { RegistrationConsents } from "@/features/privacy/components/RegistrationConsents";
import { privacyApi, privacyKeys } from "@/features/privacy/api/privacy.api";
import { buildRegistrationConsents, missingRequired, missingRequiredMessage, type RegistrationTicks } from "@/features/privacy/lib/consent-logic";
import { PasswordRequirements } from "@/shared/components/PasswordRequirements";
import { authApi } from "../api/auth.api";
import { Turnstile, useCaptcha } from "@/shared/components/Turnstile";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { applyServerFormError } from "@/shared/api/form-errors";
import { ApiError, apiFieldErrors } from "@/shared/api/http-client";

const FORM_FIELDS = ["confirmPassword", "email", "firstName", "lastName", "password", "professionalExperience", "whatsappNumber"] as const;

const EXPERIENCE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "junior", label: "Junior (0–2 years)" },
  { value: "mid", label: "Mid-level (3–5 years)" },
  { value: "senior", label: "Senior (5–10 years)" },
  { value: "lead", label: "Lead / Principal (10+ years)" },
] as const;

// confirmPassword has no backend/shared-schema equivalent — it's pure client-side validation,
// stripped back out before hitting authApi.register. Consent is not a form field: the ticks are
// held beside the form and sent as the accepted policy versions (TASK-025), which the server
// checks and records.
const RegisterFormSchema = RegisterSchema.omit({ consents: true }).extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

export function RegisterForm() {
  const router = useRouter();
  const captcha = useCaptcha();
  const policies = useQuery({ queryKey: privacyKeys.policies, queryFn: privacyApi.policies, staleTime: 60_000 });
  const [ticks, setTicks] = useState<RegistrationTicks>({});
  const [consentError, setConsentError] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(RegisterFormSchema) });

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => router.push("/login?registered=true"),
    onError: (err) => {
      // A policy changed while the form was open: reload what is in force and ask again.
      if (err instanceof ApiError && err.status === 409 && /was updated/i.test(String((err.body as { message?: string } | null)?.message ?? ""))) {
        setTicks({});
        void policies.refetch();
      }
      const consentFieldError = apiFieldErrors(err).consents;
      if (consentFieldError) setConsentError(consentFieldError);
      applyServerFormError(setError, err, FORM_FIELDS, "Registration failed");
      if (captcha.enabled) captcha.reset();
    },
  });

  function onSubmit(values: RegisterFormValues) {
    const list = policies.data ?? [];
    const missing = missingRequired(list, ticks);
    if (list.length === 0 || missing.length > 0) {
      setConsentError(list.length === 0 ? "We could not load the terms. Reload the page and try again." : missingRequiredMessage(missing));
      document.getElementById(`consent-${missing[0] ?? "terms"}`)?.focus();
      return;
    }
    setConsentError("");
    mutation.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      whatsappNumber: values.whatsappNumber,
      professionalExperience: values.professionalExperience,
      consents: buildRegistrationConsents(list, ticks),
      captchaToken: captcha.token,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Sign in
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="firstName" className="text-sm font-medium">
              First Name
            </label>
            <input id="firstName" placeholder="Kartik" className="rounded-md border border-input bg-background px-3 py-2.5" {...register("firstName")} />
            {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lastName" className="text-sm font-medium">
              Last Name
            </label>
            <input id="lastName" placeholder="Binzade" className="rounded-md border border-input bg-background px-3 py-2.5" {...register("lastName")} />
            {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@gmail.com"
            className="rounded-md border border-input bg-background px-3 py-2.5"
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="whatsappNumber" className="text-sm font-medium">
            WhatsApp Number
          </label>
          <input
            id="whatsappNumber"
            placeholder="+918793700336"
            className="rounded-md border border-input bg-background px-3 py-2.5"
            {...register("whatsappNumber")}
          />
          {errors.whatsappNumber && <p className="text-sm text-destructive">{errors.whatsappNumber.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="professionalExperience" className="text-sm font-medium">
            Professional Experience
          </label>
          <select
            id="professionalExperience"
            defaultValue=""
            className="rounded-md border border-input bg-background px-3 py-2.5"
            {...register("professionalExperience")}
          >
            <option value="" disabled>
              Select your experience level
            </option>
            {EXPERIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.professionalExperience && <p className="text-sm text-destructive">{errors.professionalExperience.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            className="rounded-md border border-input bg-background px-3 py-2.5"
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            className="rounded-md border border-input bg-background px-3 py-2.5"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
        </div>

        <PasswordRequirements password={watch("password") ?? ""} confirm={watch("confirmPassword") ?? ""} />

        {policies.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading the terms…
          </p>
        )}
        {policies.isError && (
          <p role="alert" className="text-sm text-destructive">
            We could not load the terms and privacy policy.{" "}
            <button type="button" onClick={() => void policies.refetch()} className="font-medium underline">
              Try again
            </button>
          </p>
        )}
        {policies.data && (
          <RegistrationConsents
            policies={policies.data}
            ticks={ticks}
            onToggle={(purpose, checked) => {
              setTicks((t) => ({ ...t, [purpose]: checked }));
              setConsentError("");
            }}
            error={consentError}
            errorId="consent-error"
          />
        )}

        {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}

        <Turnstile captcha={captcha} />

        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending || !policies.data || (captcha.enabled && !captcha.token)}
          className={cn(buttonVariants({ variant: "gradient" }), "w-full")}
        >
          <Lock className="h-4 w-4" />
          {mutation.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
