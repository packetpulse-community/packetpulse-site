"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoginSchema, type LoginDto } from "@packetpulse/types";
import { authApi } from "../api/auth.api";
import { ApiError } from "@/shared/api/http-client";

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
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="rounded-md border border-input bg-background px-3 py-2"
          {...register("email")}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-muted-foreground">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="rounded-md border border-input bg-background px-3 py-2"
          {...register("password")}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
