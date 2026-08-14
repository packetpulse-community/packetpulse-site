"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import {
  ForgotPasswordSchema,
  type ForgotPasswordDto,
  VerifyOtpSchema,
  type VerifyOtpDto,
  ResetPasswordSchema,
  type ResetPasswordDto,
} from "@packetpulse/types";
import { authApi } from "../api/auth.api";
import { ApiError } from "@/shared/api/http-client";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

const inputClass = "rounded-md border border-input bg-background px-3 py-2.5";
const buttonClass =
  "flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

function RequestOtpStep({ onRequested }: { onRequested: (email: string) => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({ resolver: zodResolver(ForgotPasswordSchema) });

  const mutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (_, dto) => onRequested(dto.email),
    onError: (err) => setError("root", { message: errorMessage(err, "Could not send the reset code") }),
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">Enter your email and we'll send you a reset code.</p>
      <div className="flex flex-col gap-1">
        <input type="email" placeholder="Email address" className={inputClass} {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
      <button type="submit" disabled={isSubmitting || mutation.isPending} className={buttonClass}>
        {mutation.isPending ? "Sending…" : "Send reset code"}
      </button>
    </form>
  );
}

function VerifyOtpStep({ email, onVerified }: { email: string; onVerified: (tempToken: string) => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpDto>({ resolver: zodResolver(VerifyOtpSchema), defaultValues: { email } });

  const mutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: (result) => onVerified(result.tempToken),
    onError: (err) => setError("root", { message: errorMessage(err, "Invalid or expired code") }),
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">Enter the 6-digit code sent to {email}.</p>
      <input type="hidden" {...register("email")} />
      <div className="flex flex-col gap-1">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit code"
          className={inputClass}
          {...register("otp")}
        />
        {errors.otp && <p className="text-sm text-destructive">{errors.otp.message}</p>}
      </div>
      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
      <button type="submit" disabled={isSubmitting || mutation.isPending} className={buttonClass}>
        {mutation.isPending ? "Verifying…" : "Verify code"}
      </button>
    </form>
  );
}

function ResetPasswordStep({ tempToken }: { tempToken: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordDto>({ resolver: zodResolver(ResetPasswordSchema), defaultValues: { tempToken } });

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => router.push("/login?reset=true"),
    onError: (err) => setError("root", { message: errorMessage(err, "Could not reset your password") }),
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">Choose a new password.</p>
      <input type="hidden" {...register("tempToken")} />
      <div className="flex flex-col gap-1">
        <input type="password" placeholder="New password" className={inputClass} {...register("password")} />
        <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
      <button type="submit" disabled={isSubmitting || mutation.isPending} className={buttonClass}>
        <Lock className="h-4 w-4" />
        {mutation.isPending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}

export function ForgotPasswordFlow() {
  const [step, setStep] = useState<{ stage: "request" } | { stage: "verify"; email: string } | { stage: "reset"; tempToken: string }>({
    stage: "request",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Remembered it after all?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Sign in
          </Link>
        </p>
      </div>

      {step.stage === "request" && <RequestOtpStep onRequested={(email) => setStep({ stage: "verify", email })} />}
      {step.stage === "verify" && (
        <VerifyOtpStep email={step.email} onVerified={(tempToken) => setStep({ stage: "reset", tempToken })} />
      )}
      {step.stage === "reset" && <ResetPasswordStep tempToken={step.tempToken} />}
    </div>
  );
}
