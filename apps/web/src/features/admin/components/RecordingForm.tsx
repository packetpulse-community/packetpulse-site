"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreateRecordingSchema, type CreateRecordingDto } from "@packetpulse/types";
import { recordingsClientApi, type RecordingSummary } from "@/features/recordings/api/recordings.api";
import { ApiError } from "@/shared/api/http-client";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;

const optionalUrl = z.preprocess((val) => (val === "" ? undefined : val), z.string().url().optional());

const RecordingFormSchema = CreateRecordingSchema.extend({
  thumbnailUrl: optionalUrl,
  tags: z.string().optional(),
});
type RecordingFormValues = z.infer<typeof RecordingFormSchema>;

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export function RecordingForm({
  recording,
  open,
  onClose,
}: {
  recording?: RecordingSummary;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!recording;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordingFormValues>({
    resolver: zodResolver(RecordingFormSchema),
    values: recording
      ? {
          title: recording.title,
          description: recording.description,
          recordingUrl: recording.recordingUrl,
          thumbnailUrl: recording.thumbnailUrl ?? undefined,
          durationSeconds: recording.durationSeconds,
          category: recording.category as CreateRecordingDto["category"],
          premium: recording.premium,
          tags: recording.tags.map((t) => t.tag).join(", "),
        }
      : undefined,
    defaultValues: { durationSeconds: 0, premium: false, tags: "" },
  });

  const mutation = useMutation({
    mutationFn: (dto: CreateRecordingDto) =>
      isEdit ? recordingsClientApi.update(recording!.id, dto) : recordingsClientApi.create(dto),
    onSuccess: () => {
      toast.success(isEdit ? "Recording updated" : "Recording created");
      router.refresh();
      reset();
      onClose();
    },
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save recording") }),
  });

  function onSubmit(values: RecordingFormValues) {
    const tags = values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    mutation.mutate({ ...values, tags });
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Recording" : "Create Recording"} className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Title</label>
          <input className={inputClass} {...register("title")} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea rows={3} className={inputClass} {...register("description")} />
          {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Recording URL</label>
          <input className={inputClass} {...register("recordingUrl")} />
          {errors.recordingUrl && <p className="text-sm text-destructive">{errors.recordingUrl.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Thumbnail URL</label>
          <input className={inputClass} {...register("thumbnailUrl")} />
          {errors.thumbnailUrl && <p className="text-sm text-destructive">{errors.thumbnailUrl.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Category</label>
            <select className={inputClass} {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Duration (seconds)</label>
            <input type="number" className={inputClass} {...register("durationSeconds")} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <input className={inputClass} {...register("tags")} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("premium")} />
          Premium
        </label>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create recording"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
