"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { ChangePasswordSchema, type ChangePasswordDto } from "@packetpulse/types";
import { profileClientApi } from "../api/profile.api";
import { ApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

const inputClass = "rounded-md border border-input bg-background px-3 py-2.5";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordDto>({ resolver: zodResolver(ChangePasswordSchema) });

  const mutation = useMutation({
    mutationFn: profileClientApi.changePassword,
    onSuccess: () => {
      toast.success("Password changed. Other sessions have been signed out.");
      reset();
    },
    onError: (err) => setError("root", { message: errorMessage(err, "Could not change your password") }),
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Current Password
        </label>
        <input id="currentPassword" type="password" className={inputClass} {...register("currentPassword")} />
        {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium">
          New Password
        </label>
        <input id="newPassword" type="password" className={inputClass} {...register("newPassword")} />
        <p className="text-xs text-muted-foreground">At least 8 characters, with a number and a special character</p>
        {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
      </div>

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}
      >
        <Lock className="h-4 w-4" />
        {mutation.isPending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
