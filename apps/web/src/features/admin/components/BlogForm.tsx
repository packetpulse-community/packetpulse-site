"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreateBlogPostSchema, type CreateBlogPostDto } from "@packetpulse/types";
import { blogsClientApi, type BlogPostSummary } from "@/features/blogs/api/blogs.api";
import { ApiError } from "@/shared/api/http-client";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;

const optionalUrl = z.preprocess((val) => (val === "" ? undefined : val), z.string().url().optional());

const BlogFormSchema = CreateBlogPostSchema.extend({
  coverImageUrl: optionalUrl,
  tags: z.string().optional(),
});
type BlogFormValues = z.infer<typeof BlogFormSchema>;

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export function BlogForm({
  post,
  open,
  onClose,
}: {
  post?: BlogPostSummary;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!post;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BlogFormValues>({
    resolver: zodResolver(BlogFormSchema),
    values: post
      ? {
          title: post.title,
          content: post.content,
          category: post.category as CreateBlogPostDto["category"],
          coverImageUrl: post.coverImageUrl ?? undefined,
          tags: post.tags.map((t) => t.tag).join(", "),
        }
      : undefined,
    defaultValues: { tags: "" },
  });

  const mutation = useMutation({
    mutationFn: (dto: CreateBlogPostDto) => (isEdit ? blogsClientApi.update(post!.id, dto) : blogsClientApi.create(dto)),
    onSuccess: () => {
      toast.success(isEdit ? "Post updated" : "Post created");
      router.refresh();
      reset();
      onClose();
    },
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save post") }),
  });

  function onSubmit(values: BlogFormValues) {
    const tags = values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    mutation.mutate({ ...values, tags });
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Blog Post" : "Create Blog Post"} className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Cover Image URL</label>
          <input className={inputClass} {...register("coverImageUrl")} />
          {errors.coverImageUrl && <p className="text-sm text-destructive">{errors.coverImageUrl.message}</p>}
        </div>

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
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <input className={inputClass} {...register("tags")} />
        </div>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create post"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
