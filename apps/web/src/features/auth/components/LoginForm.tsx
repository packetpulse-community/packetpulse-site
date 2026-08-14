"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { LoginSchema, type LoginDto } from "@packetpulse/types";
import { authApi } from "../api/auth.api";
import { ApiError } from "@/shared/api/http-client";
import { SocialLoginRow } from "./SocialLoginRow";

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({ resolver: zodResolver(LoginSchema) });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? (err.body as { message?: string })?.message : undefined;
      setError("root", { message: message ?? "Login failed" });
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

      <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
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
          <Link href="/forgot-password" className="font-medium text-brand hover:underline">
            Forgot your password?
          </Link>
        </div>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Lock className="h-4 w-4" />
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <SocialLoginRow />
    </div>
  );
}
