"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { UpdateSiteSettingsSchema, type UpdateSiteSettingsDto } from "@packetpulse/types";
import { adminClientApi, type SiteSettings } from "../api/admin.api";
import { ApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/primitives/Card";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSiteSettingsDto>({
    resolver: zodResolver(UpdateSiteSettingsSchema),
    defaultValues: {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      maintenanceMode: settings.maintenanceMode,
      registrationEnabled: settings.registrationEnabled,
      maxUploadSizeMb: settings.maxUploadSizeMb,
      maxUserResourcesCount: settings.maxUserResourcesCount,
      emailVerificationRequired: settings.emailVerificationRequired,
      adminEmail: settings.adminEmail,
      apiRateLimit: settings.apiRateLimit,
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
      theme: settings.theme,
      logLevel: settings.logLevel,
    },
  });

  const mutation = useMutation({
    mutationFn: adminClientApi.updateSettings,
    onSuccess: () => toast.success("Settings saved"),
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save settings") }),
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-8">
      <Card variant="glass">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Site Name</label>
            <input className={inputClass} {...register("siteName")} />
            {errors.siteName && <p className="text-sm text-destructive">{errors.siteName.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Admin Email</label>
            <input type="email" className={inputClass} {...register("adminEmail")} />
            {errors.adminEmail && <p className="text-sm text-destructive">{errors.adminEmail.message}</p>}
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium">Site Description</label>
            <textarea rows={2} className={inputClass} {...register("siteDescription")} />
            {errors.siteDescription && <p className="text-sm text-destructive">{errors.siteDescription.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("registrationEnabled")} />
            Enable user registration
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("emailVerificationRequired")} />
            Require email verification
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Session Timeout (minutes)</label>
            <input type="number" className={inputClass} {...register("sessionTimeoutMinutes")} />
            {errors.sessionTimeoutMinutes && <p className="text-sm text-destructive">{errors.sessionTimeoutMinutes.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Max Resources Per User</label>
            <input type="number" className={inputClass} {...register("maxUserResourcesCount")} />
            {errors.maxUserResourcesCount && <p className="text-sm text-destructive">{errors.maxUserResourcesCount.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("maintenanceMode")} />
              Maintenance mode
            </label>
            <p className="text-xs text-muted-foreground">When enabled, only administrators can access the site.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Max Upload Size (MB)</label>
            <input type="number" className={inputClass} {...register("maxUploadSizeMb")} />
            {errors.maxUploadSizeMb && <p className="text-sm text-destructive">{errors.maxUploadSizeMb.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">API Rate Limit (requests/minute)</label>
            <input type="number" className={inputClass} {...register("apiRateLimit")} />
            {errors.apiRateLimit && <p className="text-sm text-destructive">{errors.apiRateLimit.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Default Theme</label>
            <select className={inputClass} {...register("theme")}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System Default</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Log Level</label>
            <select className={inputClass} {...register("logLevel")}>
              <option value="error">Error only</option>
              <option value="warn">Warning and Error</option>
              <option value="info">Info, Warning and Error</option>
              <option value="debug">All (Debug)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting || mutation.isPending} className={cn(buttonVariants({ variant: "gradient" }))}>
          {mutation.isPending ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
