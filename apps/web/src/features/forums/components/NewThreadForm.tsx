"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FORUM_DETAIL_MIN,
  FORUM_MODE_LABELS,
  FORUM_THREAD_MODES,
  FORUM_TITLE_MIN,
  type ForumThreadMode,
} from "@packetpulse/types";
import { cn } from "@/shared/utils/cn";
import { apiFieldErrors } from "@/shared/api/http-client";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { useFeatureFlag } from "@/features/feature-flags/hooks/useFeatureFlags";
import { FeatureOffState } from "@/features/feature-flags/components/FeatureOffState";
import { forumErrorMessage, forumsClientApi } from "../api/forums.api";
import type { ForumCategory } from "../api/forums.api";

const MODE_HELP: Record<ForumThreadMode, string> = {
  learning: "You are learning a topic and want an explanation.",
  production: "Something is broken or risky on a live network.",
  expert: "A design or trade-off you want experienced people to weigh in on.",
};

export const GUIDELINES_STATUS_KEY = ["forums", "guidelines-status"] as const;

export function NewThreadForm({ categories }: { categories: ForumCategory[] }) {
  const id = useId();
  const router = useRouter();
  const qc = useQueryClient();
  const { enabled: postingOn } = useFeatureFlag("forums.posting");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [mode, setMode] = useState<ForumThreadMode>("learning");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const guidelines = useQuery({ queryKey: GUIDELINES_STATUS_KEY, queryFn: forumsClientApi.guidelinesStatus, staleTime: 60_000 });
  // While the status is unknown the box is shown (fail safe): the server enforces acceptance anyway.
  const mustAccept = guidelines.data ? guidelines.data.mustAccept : true;

  const mutation = useMutation({
    mutationFn: async () => {
      if (mustAccept) {
        await forumsClientApi.acceptGuidelines();
        qc.invalidateQueries({ queryKey: GUIDELINES_STATUS_KEY });
      }
      return forumsClientApi.createThread({ categoryId, title: title.trim(), content: content.trim(), mode, sensitiveDataConfirmed: true });
    },
    onSuccess: (thread) => {
      router.push(`/forums/${thread.id}`);
      router.refresh();
    },
    onError: (err) => {
      const fields = apiFieldErrors(err);
      setErrors(fields);
      setFormError(Object.keys(fields).length ? "Check the highlighted fields." : forumErrorMessage(err));
    },
  });

  if (!postingOn) {
    return <FeatureOffState feature="Forum posting" stillWorks="You can still read every thread." backHref="/forums" backLabel="Back to forums" />;
  }

  function validate() {
    const next: Record<string, string> = {};
    if (title.trim().length < FORUM_TITLE_MIN) next.title = `The title needs at least ${FORUM_TITLE_MIN} characters (now ${title.trim().length}).`;
    if (content.trim().length < FORUM_DETAIL_MIN) next.content = `Add detail: at least ${FORUM_DETAIL_MIN} characters (now ${content.trim().length}).`;
    if (!confirmed) next.sensitiveDataConfirmed = "Confirm that you removed passwords, keys and customer data.";
    if (mustAccept && !agreed) next.guidelines = "Accept the community guidelines to post.";
    return next;
  }

  const err = (k: string) => errors[k];
  const field = (k: string) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `${id}-${k}-error` : undefined });
  const fieldError = (k: string) =>
    err(k) ? (
      <p id={`${id}-${k}-error`} role="alert" className="text-sm text-danger">
        ⚠ {err(k)}
      </p>
    ) : null;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        const next = validate();
        setErrors(next);
        if (Object.keys(next).length === 0) mutation.mutate();
      }}
      className="border border-border bg-surface flex flex-col gap-4 rounded-lg p-4"
    >
      <h2 className="text-lg font-semibold">Ask a question</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-category`} className="text-sm font-medium">
          Category
        </label>
        <select
          id={`${id}-category`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">What kind of question is it?</legend>
        {FORUM_THREAD_MODES.map((m) => (
          <label key={m} className="flex items-start gap-2 text-sm">
            <input type="radio" name={`${id}-mode`} value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1" />
            <span>
              <span className="font-medium">{FORUM_MODE_LABELS[m]}</span> — {MODE_HELP[m]}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-title`} className="text-sm font-medium">
          Title
        </label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g. How does OSPF elect a designated router?"
          className="rounded-md border border-input bg-background px-3 py-2"
          {...field("title")}
        />
        {fieldError("title")}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-content`} className="text-sm font-medium">
          Details
        </label>
        <textarea
          id={`${id}-content`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="What did you try, and what happened?"
          className="rounded-md border border-input bg-background px-3 py-2"
          {...field("content")}
        />
        {fieldError("content")}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" {...field("sensitiveDataConfirmed")} />
          <span>I removed passwords, keys, customer data and confidential network configurations from this post.</span>
        </label>
        {fieldError("sensitiveDataConfirmed")}
      </div>

      {mustAccept && (
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" {...field("guidelines")} />
            <span>
              I have read and accept the{" "}
              <Link href="/forums/guidelines" className="underline" target="_blank" rel="noopener">
                community guidelines
              </Link>
              . This is asked once, before your first post.
            </span>
          </label>
          {fieldError("guidelines")}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Before you post, read the{" "}
        <Link href="/forums/guidelines" className="underline">
          community guidelines
        </Link>
        .
      </p>

      {formError && (
        <p role="alert" className="text-sm text-danger">
          ⚠ {formError}
        </p>
      )}

      <button type="submit" disabled={mutation.isPending} className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}>
        {mutation.isPending ? "Posting…" : "Post question"}
      </button>
    </form>
  );
}
