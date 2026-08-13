"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { RegisterSchema, type RegisterDto } from "@packetpulse/types";
import { authApi } from "../api/auth.api";
import { ApiError } from "@/shared/api/http-client";

export function RegisterForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({ resolver: zodResolver(RegisterSchema) });

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => router.push("/login?registered=true"),
    onError: (err) => {
      const message = err instanceof ApiError ? (err.body as { message?: string })?.message : undefined;
      setError("root", { message: message ?? "Registration failed" });
    },
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="firstName" className="text-sm text-muted-foreground">
            First name
          </label>
          <input id="firstName" className="rounded-md border border-input bg-background px-3 py-2" {...register("firstName")} />
          {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lastName" className="text-sm text-muted-foreground">
            Last name
          </label>
          <input id="lastName" className="rounded-md border border-input bg-background px-3 py-2" {...register("lastName")} />
          {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          Email
        </label>
        <input id="email" type="email" className="rounded-md border border-input bg-background px-3 py-2" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-muted-foreground">
          Password
        </label>
        <input id="password" type="password" className="rounded-md border border-input bg-background px-3 py-2" {...register("password")} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
