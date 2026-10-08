"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { ChangePasswordSchema, type ChangePasswordDto } from "@packetpulse/types";
import { profileClientApi } from "../api/profile.api";
import { ApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { PasswordRequirements } from "@/shared/components/PasswordRequirements";

const inputClass = "rounded-md border border-input bg-background px-3 py-2.5";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

// confirmNewPassword is client-only — stripped before the request.
const ChangePasswordFormSchema = ChangePasswordSchema.extend({ confirmNewPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });
type ChangePasswordFormValues = z.infer<typeof ChangePasswordFormSchema>;

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(ChangePasswordFormSchema) });

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordDto) =>
      profileClientApi.changePassword({ currentPassword, newPassword }),
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
        <input id="newPassword" type="password" autoComplete="new-password" className={inputClass} {...register("newPassword")} />
        {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmNewPassword" className="text-sm font-medium">
          Confirm New Password
        </label>
        <input
          id="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register("confirmNewPassword")}
        />
        {errors.confirmNewPassword && <p className="text-sm text-destructive">{errors.confirmNewPassword.message}</p>}
      </div>

      <PasswordRequirements password={watch("newPassword") ?? ""} confirm={watch("confirmNewPassword") ?? ""} />

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
