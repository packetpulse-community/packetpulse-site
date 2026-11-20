"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, MessageCircle } from "lucide-react";
import {
  ConfirmWhatsappNumberSchema,
  UpdateNotificationPreferencesSchema,
  type ConfirmWhatsappNumberInput,
  type NotificationPreferencesView,
  type UpdateNotificationPreferencesInput,
} from "@packetpulse/types";
import { notificationsApi } from "../api/notifications.api";
import { ApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { Skeleton } from "@/shared/ui/primitives/Skeleton";

const inputClass = "rounded-md border border-input bg-background px-3 py-2.5";
const checkboxClass = "h-4 w-4 rounded border-input accent-indigo-600";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

// Form values: only the switches a member may change (allowed channels, not locked). Critical
// events' email and every in-app switch are shown but are not part of the form.
function toFormValues(view: NotificationPreferencesView): UpdateNotificationPreferencesInput {
  const events: NonNullable<UpdateNotificationPreferencesInput["events"]> = {};
  for (const e of view.events) {
    const flags: { email?: boolean; whatsapp?: boolean } = {};
    if (e.channels.email.allowed && !e.channels.email.locked) flags.email = e.channels.email.enabled;
    if (e.channels.whatsapp.allowed) flags.whatsapp = e.channels.whatsapp.enabled;
    if (Object.keys(flags).length) events[e.type] = flags;
  }
  return {
    events,
    quietHoursEnabled: view.quietHoursEnabled,
    quietHoursStart: view.quietHoursStart,
    quietHoursEnd: view.quietHoursEnd,
    digestFrequency: view.digestFrequency,
    marketingOptIn: view.marketingOptIn,
    whatsappOptIn: view.whatsapp.optIn,
  };
}

// SCR-037. Loads the member's preferences, then renders the form.
export function NotificationPreferencesForm() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: notificationsApi.getPreferences,
  });

  if (isPending) {
    return (
      <div role="status" aria-label="Loading notification settings" className="flex flex-col gap-4">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="We could not load your notification settings."
        description="Check your connection and try again. Nothing was changed."
        retry={{ label: "Try again", onClick: () => void refetch() }}
      />
    );
  }
  return <PreferencesFormBody view={data} />;
}

function PreferencesFormBody({ view }: { view: NotificationPreferencesView }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateNotificationPreferencesInput>({
    resolver: zodResolver(UpdateNotificationPreferencesSchema),
    defaultValues: toFormValues(view),
  });

  const save = useMutation({
    mutationFn: (dto: UpdateNotificationPreferencesInput) => notificationsApi.updatePreferences(dto),
    onSuccess: (updated) => {
      queryClient.setQueryData(["notifications", "preferences"], updated);
      reset(toFormValues(updated));
      toast.success("Notification settings saved.");
    },
    // Entered values stay in the form on error (no reset).
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save your settings. Try again.") }),
  });

  const quietOn = watch("quietHoursEnabled");
  const whatsappOptIn = watch("whatsappOptIn");
  const hasNumber = !!view.whatsapp.numberMasked;
  const dailyCap = view.dailyCap;

  return (
    <form onSubmit={handleSubmit((dto) => save.mutate(dto))} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>What you receive</CardTitle>
          <CardDescription>
            In-app notifications are always on. Critical events are always sent by email and cannot be switched off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-4 font-medium">Event</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">In-app</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">Email</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {view.events.map((e) => (
                  <tr key={e.type} className="border-b border-border/60 align-top">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <span className="font-medium">{e.label}</span>
                      {e.critical && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                          <Lock className="h-3 w-3" aria-hidden="true" /> Critical
                        </span>
                      )}
                      {!e.emitted && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Coming soon</span>
                      )}
                      <span className="block text-xs text-muted-foreground">{e.description}</span>
                      {e.criticalCondition && (
                        <span className="block text-xs text-muted-foreground">
                          Sent even in quiet hours when the {e.criticalCondition}.
                        </span>
                      )}
                    </th>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox" checked disabled aria-label={`${e.label} in the app (always on)`} className={checkboxClass} />
                    </td>
                    <td className="px-2 py-3 text-center">
                      {!e.channels.email.allowed ? (
                        <span aria-label="Not available">—</span>
                      ) : e.channels.email.locked ? (
                        <input
                          type="checkbox"
                          checked
                          disabled
                          aria-label={`${e.label} by email (always sent)`}
                          className={checkboxClass}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`${e.label} by email`}
                          className={checkboxClass}
                          {...register(`events.${e.type}.email`)}
                        />
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {e.channels.whatsapp.allowed ? (
                        <input
                          type="checkbox"
                          disabled={!whatsappOptIn}
                          aria-label={`${e.label} by WhatsApp`}
                          className={checkboxClass}
                          {...register(`events.${e.type}.whatsapp`)}
                        />
                      ) : (
                        <span aria-label="Not available">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            To keep your inbox calm we send at most {dailyCap} non-critical emails or WhatsApp messages a day. The rest still appear in the app.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiet hours</CardTitle>
          <CardDescription>
            Non-critical emails wait until quiet hours end ({view.timezone === "Asia/Kolkata" ? "India time, IST" : view.timezone}).
            Interview and offer messages always reach you, even in quiet hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className={checkboxClass} {...register("quietHoursEnabled")} />
            Use quiet hours
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="quietHoursStart" className="text-sm font-medium">
                From
              </label>
              <input id="quietHoursStart" type="time" disabled={!quietOn} className={inputClass} {...register("quietHoursStart")} />
              {errors.quietHoursStart && <p className="text-sm text-destructive">{errors.quietHoursStart.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="quietHoursEnd" className="text-sm font-medium">
                Until
              </label>
              <input id="quietHoursEnd" type="time" disabled={!quietOn} className={inputClass} {...register("quietHoursEnd")} />
              {errors.quietHoursEnd && <p className="text-sm text-destructive">{errors.quietHoursEnd.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp</CardTitle>
          <CardDescription>
            Opt-in only, for interview and offer messages. We only message a number you have confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <WhatsappNumberForm view={view} />
          <label className={cn("flex items-center gap-2 text-sm font-medium", !hasNumber && "opacity-60")}>
            <input type="checkbox" disabled={!hasNumber} className={checkboxClass} {...register("whatsappOptIn")} />
            Send me WhatsApp messages for the events I tick above
          </label>
          {!hasNumber && <p className="text-xs text-muted-foreground">Add your number first, then you can opt in.</p>}
          {!view.whatsapp.providerConfigured && (
            <p className="text-xs text-muted-foreground">
              WhatsApp messages are not switched on yet. Your choice is saved and takes effect when they are.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Digest and marketing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="digestFrequency" className="text-sm font-medium">
              Community replies digest
            </label>
            <select id="digestFrequency" className={cn(inputClass, "w-fit")} {...register("digestFrequency")}>
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Replies and comments can be bundled into one email. Digest emails are not sent yet; your choice is saved.
            </p>
            {errors.digestFrequency && <p className="text-sm text-destructive">{errors.digestFrequency.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className={checkboxClass} {...register("marketingOptIn")} />
              Send me news and offers from PacketPulse
            </label>
            <p className="text-xs text-muted-foreground">
              Separate from everything above and off unless you turn it on. Every such message has an unsubscribe link.
            </p>
          </div>
        </CardContent>
      </Card>

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={save.isPending || !isDirty}
        className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}
      >
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

// Number confirmation is its own small form (a form cannot nest inside the settings form).
function WhatsappNumberForm({ view }: { view: NotificationPreferencesView }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ConfirmWhatsappNumberInput>({ resolver: zodResolver(ConfirmWhatsappNumberSchema) });

  const confirm = useMutation({
    mutationFn: (dto: ConfirmWhatsappNumberInput) => notificationsApi.confirmWhatsappNumber(dto),
    onSuccess: () => {
      toast.success("Confirmation request saved.");
      void queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
    onError: (err) => setError("number", { message: errorMessage(err, "Could not save your number. Try again.") }),
  });

  const status = view.whatsapp.confirmedAt
    ? "Confirmed"
    : view.whatsapp.confirmationRequestedAt
      ? "Confirmation pending"
      : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="whatsappNumber" className="text-sm font-medium">
          WhatsApp number
        </label>
        <div className="flex flex-wrap items-start gap-2">
          <input
            id="whatsappNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+919876543210"
            aria-describedby="whatsappNumberHelp"
            className={cn(inputClass, "w-64")}
            {...register("number")}
          />
          <button
            type="button"
            disabled={confirm.isPending}
            onClick={() => void handleSubmit((dto) => confirm.mutate(dto))()}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {confirm.isPending ? "Saving…" : "Confirm number"}
          </button>
        </div>
        {errors.number && <p className="text-sm text-destructive">{errors.number.message}</p>}
        <p id="whatsappNumberHelp" className="text-xs text-muted-foreground">
          International format, for example +919876543210.
          {view.whatsapp.numberMasked && (
            <>
              {" "}
              On file: {view.whatsapp.numberMasked}
              {status ? ` (${status.toLowerCase()})` : ""}.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
