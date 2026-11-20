"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { UpdateProfileSchema, type UpdateProfileDto } from "@packetpulse/types";
import { profileClientApi } from "../api/profile.api";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import type { SessionUser } from "@/shared/auth/session";
import { applyServerFormError } from "@/shared/api/form-errors";

const FORM_FIELDS = ["bio", "firstName", "lastName", "whatsappNumber"] as const;

const inputClass = "rounded-md border border-input bg-background px-3 py-2.5";

export function EditProfileForm({ user }: { user: SessionUser }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileDto>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: profileClientApi.updateProfile,
    onSuccess: () => toast.success("Profile updated"),
    onError: (err) => applyServerFormError(setError, err, FORM_FIELDS, "Could not update your profile"),
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="firstName" className="text-sm font-medium">
            First Name
          </label>
          <input id="firstName" className={inputClass} {...register("firstName")} />
          {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last Name
          </label>
          <input id="lastName" className={inputClass} {...register("lastName")} />
          {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="whatsappNumber" className="text-sm font-medium">
          WhatsApp Number
        </label>
        <input id="whatsappNumber" className={inputClass} {...register("whatsappNumber")} />
        {errors.whatsappNumber && <p className="text-sm text-destructive">{errors.whatsappNumber.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="bio" className="text-sm font-medium">
          Bio
        </label>
        <textarea id="bio" rows={4} className={inputClass} {...register("bio")} />
        {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
      </div>

      {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}
      >
        {mutation.isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
