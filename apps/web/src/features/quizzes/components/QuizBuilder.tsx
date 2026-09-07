"use client";

import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CreateQuizSchema, type CreateQuizDto } from "@packetpulse/types";
import { cn } from "@/shared/utils/cn";
import { Button, buttonVariants } from "@/shared/ui/primitives/Button";
import { quizzesClientApi } from "../api/quizzes.api";
import { ApiError } from "@/shared/api/http-client";

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;
const inputClass = "rounded-md border border-input bg-background px-3 py-2";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

function QuestionOptions({
  control,
  register,
  questionIndex,
}: {
  control: Control<CreateQuizDto>;
  register: UseFormRegister<CreateQuizDto>;
  questionIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `questions.${questionIndex}.options` });

  return (
    <div className="flex flex-col gap-2 pl-4">
      {fields.map((field, optionIndex) => (
        <div key={field.id} className="flex items-center gap-2">
          <input type="checkbox" {...register(`questions.${questionIndex}.options.${optionIndex}.isCorrect`)} />
          <input
            placeholder="Option text"
            className={cn(inputClass, "flex-1")}
            {...register(`questions.${questionIndex}.options.${optionIndex}.optionText`)}
          />
          <Button type="button" variant="glass" size="sm" onClick={() => remove(optionIndex)} disabled={fields.length <= 2}>
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="glass"
        size="sm"
        className="w-fit"
        onClick={() => append({ optionText: "", isCorrect: false })}
      >
        Add option
      </Button>
    </div>
  );
}

export function QuizBuilder() {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateQuizDto>({
    resolver: zodResolver(CreateQuizSchema),
    defaultValues: {
      category: "general",
      passingScorePct: 70,
      isPublished: false,
      questions: [{ questionText: "", questionType: "single_choice", points: 1, options: [{ optionText: "", isCorrect: false }, { optionText: "", isCorrect: false }] }],
    },
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control,
    name: "questions",
  });

  const mutation = useMutation({
    mutationFn: quizzesClientApi.createQuiz,
    onSuccess: (quiz) => router.push(`/quizzes/${quiz.id}`),
    onError: (err) => setError("root", { message: errorMessage(err, "Could not create quiz") }),
  });

  return (
    <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-6">
      <div className="glass-panel flex flex-col gap-4 rounded-lg p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input id="title" className={inputClass} {...register("title")} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea id="description" rows={3} className={inputClass} {...register("description")} />
          {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="category" className="text-sm font-medium">
              Category
            </label>
            <select id="category" className={inputClass} {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="passingScorePct" className="text-sm font-medium">
              Passing score (%)
            </label>
            <input id="passingScorePct" type="number" min={1} max={100} className={inputClass} {...register("passingScorePct")} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="timeLimitSeconds" className="text-sm font-medium">
              Time limit (seconds, optional)
            </label>
            <input
              id="timeLimitSeconds"
              type="number"
              min={1}
              className={inputClass}
              {...register("timeLimitSeconds", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isPublished")} />
          Publish immediately
        </label>
      </div>

      {questionFields.map((field, questionIndex) => (
        <fieldset key={field.id} className="glass-panel flex flex-col gap-3 rounded-lg p-4">
          <legend className="px-1 font-medium">Question {questionIndex + 1}</legend>

          <input
            placeholder="Question text"
            className={inputClass}
            {...register(`questions.${questionIndex}.questionText`)}
          />
          {errors.questions?.[questionIndex]?.questionText && (
            <p className="text-sm text-destructive">{errors.questions[questionIndex]?.questionText?.message}</p>
          )}

          <div className="flex gap-4">
            <select className={inputClass} {...register(`questions.${questionIndex}.questionType`)}>
              <option value="single_choice">Single choice</option>
              <option value="multi_choice">Multiple choice</option>
            </select>
            <input
              type="number"
              min={1}
              placeholder="Points"
              className={cn(inputClass, "w-24")}
              {...register(`questions.${questionIndex}.points`)}
            />
          </div>

          <QuestionOptions control={control} register={register} questionIndex={questionIndex} />

          <Button
            type="button"
            variant="glass"
            size="sm"
            className="w-fit"
            onClick={() => removeQuestion(questionIndex)}
            disabled={questionFields.length <= 1}
          >
            Remove question
          </Button>
        </fieldset>
      ))}

      <Button
        type="button"
        variant="glass"
        className="w-fit"
        onClick={() =>
          appendQuestion({
            questionText: "",
            questionType: "single_choice",
            points: 1,
            options: [
              { optionText: "", isCorrect: false },
              { optionText: "", isCorrect: false },
            ],
          })
        }
      >
        Add question
      </Button>

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      <button type="submit" disabled={isSubmitting || mutation.isPending} className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}>
        {mutation.isPending ? "Creating…" : "Create quiz"}
      </button>
    </form>
  );
}
