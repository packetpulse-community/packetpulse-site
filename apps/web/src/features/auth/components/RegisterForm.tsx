"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { RegisterSchema } from "@packetpulse/types";
import { authApi } from "../api/auth.api";
import { ApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

const EXPERIENCE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "junior", label: "Junior (0–2 years)" },
  { value: "mid", label: "Mid-level (3–5 years)" },
  { value: "senior", label: "Senior (5–10 years)" },
  { value: "lead", label: "Lead / Principal (10+ years)" },
] as const;

// confirmPassword/termsAccepted have no backend/shared-schema equivalent — they're
// pure client-side validation, stripped back out before hitting authApi.register,
// which still only ever receives the exact RegisterDto shape the backend expects.
const RegisterFormSchema = RegisterSchema.extend({
  confirmPassword: z.string(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must agree to the terms to continue" }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

export function RegisterForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(RegisterFormSchema) });

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => router.push("/login?registered=true"),
    onError: (err) => {
      const message = err instanceof ApiError ? (err.body as { message?: string })?.message : undefined;
      setError("root", { message: message ?? "Registration failed" });
    },
  });

  function onSubmit(values: RegisterFormValues) {
    mutation.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      whatsappNumber: values.whatsappNumber,
      professionalExperience: values.professionalExperience,
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
          <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
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

        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-0.5 rounded border-input" {...register("termsAccepted")} />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-foreground underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-foreground underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.termsAccepted && <p className="text-sm text-destructive">{errors.termsAccepted.message}</p>}

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          className={cn(buttonVariants({ variant: "gradient" }), "w-full")}
        >
          <Lock className="h-4 w-4" />
          {mutation.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
