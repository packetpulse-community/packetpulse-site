"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { UpdateForumThreadSchema } from "@packetpulse/types";
import { forumsClientApi, type ForumThreadSummary } from "@/features/forums/api/forums.api";
import { ApiError } from "@/shared/api/http-client";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type ThreadFormValues = z.infer<typeof UpdateForumThreadSchema>;

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export function ForumThreadEditForm({ thread, open, onClose }: { thread: ForumThreadSummary; open: boolean; onClose: () => void }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ThreadFormValues>({
    resolver: zodResolver(UpdateForumThreadSchema),
    values: { title: thread.title, content: thread.content },
  });

  const mutation = useMutation({
    mutationFn: (dto: ThreadFormValues) => forumsClientApi.updateThread(thread.id, dto),
    onSuccess: () => {
      toast.success("Thread updated");
      router.refresh();
      onClose();
    },
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save thread") }),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Edit Thread" className="max-w-2xl">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Title</label>
          <input className={inputClass} {...register("title")} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Content</label>
          <textarea rows={6} className={inputClass} {...register("content")} />
          {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
        </div>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
