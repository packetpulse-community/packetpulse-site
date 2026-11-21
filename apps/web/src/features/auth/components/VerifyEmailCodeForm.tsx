"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { EMAIL_CODE_LENGTH, EMAIL_CODE_RESEND_COOLDOWN_SECONDS, VerifyEmailCodeSchema } from "@packetpulse/types";
import { authApi } from "../api/auth.api";
import { forgetEmailToVerify, recallEmailToVerify, secondsFromWaitMessage } from "../lib/verify-handoff";
import { Turnstile, useCaptcha } from "@/shared/components/Turnstile";
import { ApiError } from "@/shared/api/http-client";
import { loginUrlFor } from "@/shared/auth/safe-next";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

const inputClass = "w-full rounded-grove-control border border-input bg-background px-3 py-2.5";

function messageOf(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string } | null)?.message ?? fallback) : fallback;
}

// PRD-001 / SCR-003: type the 6-digit code from the email. Wrong or expired codes get one clear
// message (the server gives the same answer for every failure), five mistakes lock the address for
// 15 minutes, and a new code can be asked for after a cooldown.
export function VerifyEmailCodeForm({ next, codeJustSent = false }: { next?: string | null; codeJustSent?: boolean }) {
  const captcha = useCaptcha();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; code?: string; form?: string }>({});
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(codeJustSent ? EMAIL_CODE_RESEND_COOLDOWN_SECONDS : 0);
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setEmail(recallEmailToVerify()), []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    const parsed = VerifyEmailCodeSchema.safeParse({ email: email.trim(), code: code.trim() });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], code: flat.code?.[0] });
      document.getElementById(flat.email ? "verify-email" : "verify-code")?.focus();
      return;
    }
    setErrors({});
    setBusy("verify");
    try {
      await authApi.verifyEmailCode(parsed.data);
      forgetEmailToVerify();
      setDone(true);
    } catch (err) {
      setErrors({ form: messageOf(err, "That code did not work. Check it and try again.") });
      document.getElementById("verify-code")?.focus();
    } finally {
      setBusy(null);
    }
  }

  async function onResend() {
    setNotice("");
    const parsedEmail = VerifyEmailCodeSchema.shape.email.safeParse(email.trim());
    if (!parsedEmail.success) {
      setErrors({ email: "Enter the email address you signed up with" });
      document.getElementById("verify-email")?.focus();
      return;
    }
    setErrors({});
    setBusy("resend");
    try {
      await authApi.resendEmailCode({ email: parsedEmail.data, captchaToken: captcha.token });
      // Same wording whether or not the address has an account: the server does not say.
      setNotice("If that address can receive a code, a new one is on its way. It expires in 10 minutes.");
      setCooldown(EMAIL_CODE_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setCooldown(secondsFromWaitMessage(messageOf(err, ""), EMAIL_CODE_RESEND_COOLDOWN_SECONDS));
      }
      setErrors({ form: messageOf(err, "We could not send a code. Please try again.") });
    } finally {
      if (captcha.enabled) captcha.reset();
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          Email verified
        </h1>
        <p className="text-muted-foreground">Your email address is confirmed. Sign in to continue.</p>
        <Link href={loginUrlFor(next)} className={cn(buttonVariants({ variant: "gradient" }), "w-full")}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          Enter the {EMAIL_CODE_LENGTH}-digit code we emailed you. It expires in 10 minutes.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="verify-email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="verify-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "verify-email-error" : undefined}
          className={inputClass}
        />
        {errors.email && (
          <p id="verify-email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="verify-code" className="text-sm font-medium">
          Verification code
        </label>
        <input
          id="verify-code"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={EMAIL_CODE_LENGTH}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH))}
          aria-invalid={errors.code || errors.form ? true : undefined}
          aria-describedby={errors.code ? "verify-code-error" : errors.form ? "verify-form-error" : undefined}
          placeholder="123456"
          className={cn(inputClass, "text-center text-lg tracking-[0.5em]")}
        />
        {errors.code && (
          <p id="verify-code-error" className="text-sm text-destructive">
            {errors.code}
          </p>
        )}
      </div>

      {errors.form && (
        <p id="verify-form-error" role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <p role="status" aria-live="polite" className={cn("text-sm text-muted-foreground", !notice && "sr-only")}>
        {notice}
      </p>

      <Turnstile captcha={captcha} />

      <button
        type="submit"
        disabled={busy !== null}
        className={cn(buttonVariants({ variant: "gradient" }), "w-full")}
      >
        {busy === "verify" ? "Checking…" : "Verify email"}
      </button>

      <button
        type="button"
        onClick={onResend}
        disabled={busy !== null || cooldown > 0 || (captcha.enabled && !captcha.token)}
        className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
      >
        {cooldown > 0 ? `Send a new code in ${cooldown}s` : busy === "resend" ? "Sending…" : "Send a new code"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
