"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { UpdateQuizSchema } from "@packetpulse/types";
import { quizzesClientApi, type QuizForAuthoring } from "../api/quizzes.api";
import { ApiError } from "@/shared/api/http-client";
import { Button } from "@/shared/ui/primitives/Button";

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;
const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type QuizMetaFormValues = z.infer<typeof UpdateQuizSchema>;

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export function QuizMetaEditForm({ quiz }: { quiz: QuizForAuthoring }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuizMetaFormValues>({
    resolver: zodResolver(UpdateQuizSchema),
    defaultValues: {
      title: quiz.title,
      description: quiz.description,
      category: quiz.category as QuizMetaFormValues["category"],
      passingScorePct: quiz.passingScorePct,
      timeLimitSeconds: quiz.timeLimitSeconds ?? undefined,
      isPublished: quiz.isPublished,
    },
  });

  const mutation = useMutation({
    mutationFn: (dto: QuizMetaFormValues) => quizzesClientApi.updateQuiz(quiz.id, dto),
    onSuccess: () => {
      toast.success("Quiz updated");
      router.refresh();
    },
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save quiz") }),
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="glass-panel flex flex-col gap-4 rounded-lg p-4">
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

      <div className="grid gap-4 sm:grid-cols-3">
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
          <label className="text-sm font-medium">Passing score (%)</label>
          <input type="number" min={1} max={100} className={inputClass} {...register("passingScorePct")} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Time limit (seconds)</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            {...register("timeLimitSeconds", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isPublished")} />
        Published
      </label>

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <Button type="submit" variant="gradient" className="w-fit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
