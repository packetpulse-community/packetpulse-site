"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreateResourceSchema, type CreateResourceDto } from "@packetpulse/types";
import { resourcesClientApi, type ResourceSummary } from "@/features/resources/api/resources.api";
import { ApiError } from "@/shared/api/http-client";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

// Empty optional URL inputs submit as "" (not undefined) from a plain <input>,
// which z.string().url().optional() rejects — coerce "" to undefined first.
const optionalUrl = z.preprocess((val) => (val === "" ? undefined : val), z.string().url().optional());

// tags is a comma-separated text field in the UI, not the array the backend
// schema expects — swapped to a plain string here and split back into an
// array in onSubmit, since binding an <input> directly to an array field
// would fail zodResolver validation before onSubmit ever runs.
const ResourceFormSchema = CreateResourceSchema.innerType().extend({
  fileUrl: optionalUrl,
  externalLink: optionalUrl,
  thumbnailUrl: optionalUrl,
  tags: z.string().optional(),
});
type ResourceFormValues = z.infer<typeof ResourceFormSchema>;

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;
const RESOURCE_TYPES = ["pdf", "video", "article", "tutorial", "diagram", "config_template", "tool", "external_link"] as const;

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export function ResourceForm({
  resource,
  open,
  onClose,
}: {
  resource?: ResourceSummary;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!resource;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(ResourceFormSchema),
    values: resource
      ? {
          title: resource.title,
          description: resource.description,
          resourceType: resource.resourceType as CreateResourceDto["resourceType"],
          category: resource.category as CreateResourceDto["category"],
          fileUrl: resource.fileUrl ?? undefined,
          externalLink: resource.externalLink ?? undefined,
          thumbnailUrl: resource.thumbnailUrl ?? undefined,
          downloadable: resource.downloadable,
          premium: resource.premium,
          tags: resource.tags.map((t) => t.tag).join(", "),
        }
      : undefined,
    defaultValues: { downloadable: true, premium: false, tags: "" },
  });

  const mutation = useMutation({
    mutationFn: (dto: CreateResourceDto) => (isEdit ? resourcesClientApi.update(resource!.id, dto) : resourcesClientApi.create(dto)),
    onSuccess: () => {
      toast.success(isEdit ? "Resource updated" : "Resource created");
      router.refresh();
      reset();
      onClose();
    },
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save resource") }),
  });

  function onSubmit(values: ResourceFormValues) {
    const tags = values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    mutation.mutate({ ...values, tags });
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Resource" : "Create Resource"} className="max-w-2xl">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Type</label>
            <select className={inputClass} {...register("resourceType")}>
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">File URL</label>
          <input className={inputClass} {...register("fileUrl")} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">External Link</label>
          <input className={inputClass} {...register("externalLink")} />
          {errors.fileUrl && <p className="text-sm text-destructive">{errors.fileUrl.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Thumbnail URL</label>
          <input className={inputClass} {...register("thumbnailUrl")} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <input className={inputClass} {...register("tags")} />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("downloadable")} />
            Downloadable
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("premium")} />
            Premium
          </label>
        </div>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create resource"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
