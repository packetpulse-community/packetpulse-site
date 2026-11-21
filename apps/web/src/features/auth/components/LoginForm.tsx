"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { LoginSchema, type LoginDto } from "@packetpulse/types";
import { authApi } from "../api/auth.api";
import { SocialLoginRow } from "./SocialLoginRow";
import { Turnstile, useCaptcha } from "@/shared/components/Turnstile";
import { cn } from "@/shared/utils/cn";
import { safeNext } from "@/shared/auth/safe-next";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { applyServerFormError } from "@/shared/api/form-errors";

const FORM_FIELDS = ["email", "password"] as const;

export function LoginForm({
  justRegistered = false,
  passwordReset = false,
  next,
}: {
  justRegistered?: boolean;
  passwordReset?: boolean;
  /** ?next= from the URL: where to return after sign-in. Sanitised here (same-site paths only). */
  next?: string | null;
}) {
  const router = useRouter();
  const captcha = useCaptcha();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({ resolver: zodResolver(LoginSchema) });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => {
      // Deep links survive sign-in: back to the page they asked for, else the dashboard.
      router.push(safeNext(next));
      router.refresh();
    },
    onError: (err) => {
      applyServerFormError(setError, err, FORM_FIELDS, "Login failed");
      if (captcha.enabled) captcha.reset();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Sign in to your account</h1>
        <p className="text-sm text-muted-foreground">
          Or{" "}
          <Link href="/register" className="font-medium text-foreground underline">
            create a new account
          </Link>
        </p>
      </div>

      {justRegistered && (
        <p className="rounded-grove-control border border-success bg-success-soft px-4 py-3 text-sm text-success">
          Account created. An admin will review it — once it&apos;s approved you&apos;ll get an email with a link to
          verify your address, and then you can sign in.
        </p>
      )}

      {passwordReset && (
        <p className="rounded-grove-control border border-success bg-success-soft px-4 py-3 text-sm text-success">
          Your password has been reset and all other sessions were signed out. Sign in with your new password — a
          confirmation email is on its way.
        </p>
      )}

      <form onSubmit={handleSubmit((dto) => mutation.mutate({ ...dto, captchaToken: captcha.token }))} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <input
            type="email"
            placeholder="Email address"
            className="rounded-md border border-input bg-background px-3 py-2.5"
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <input
            type="password"
            placeholder="Password"
            className="rounded-md border border-input bg-background px-3 py-2.5"
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="rounded border-input" />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-primary-text hover:underline">
            Forgot your password?
          </Link>
        </div>

        {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}

        <Turnstile captcha={captcha} />

        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending || (captcha.enabled && !captcha.token)}
          className={cn(buttonVariants({ variant: "gradient" }), "w-full")}
        >
          <Lock className="h-4 w-4" />
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <SocialLoginRow />
    </div>
  );
}
