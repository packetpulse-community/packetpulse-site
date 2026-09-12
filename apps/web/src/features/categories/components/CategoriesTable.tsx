"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { CreateCategorySchema, type CreateCategoryDto, type UpdateCategoryDto } from "@packetpulse/types";
import { categoriesClientApi, type Category } from "../api/categories.api";
import { Card } from "@/shared/ui/primitives/Card";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { ApiError } from "@/shared/api/http-client";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

function CategoryForm({
  category,
  open,
  onClose,
}: {
  category?: Category;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!category;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryDto>({
    resolver: zodResolver(CreateCategorySchema),
    values: category
      ? { name: category.name, slug: category.slug, description: category.description ?? undefined }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (dto: CreateCategoryDto | UpdateCategoryDto) =>
      isEdit ? categoriesClientApi.update(category.id, dto) : categoriesClientApi.create(dto as CreateCategoryDto),
    onSuccess: () => {
      toast.success(isEdit ? "Category updated" : "Category created");
      router.refresh();
      onClose();
    },
    onError: (err) => setError("root", { message: errorMessage(err, "Could not save category") }),
  });

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Category" : "Create Category"} className="max-w-md">
      <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Name</label>
          <input className={inputClass} {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Slug</label>
          <input className={inputClass} {...register("slug")} placeholder="e.g. network-automation" />
          {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Description (optional)</label>
          <textarea rows={2} className={inputClass} {...register("description")} />
        </div>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create category"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CategoriesTable({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesClientApi.delete(id),
    onSuccess: () => {
      toast.success("Category deleted");
      router.refresh();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not delete category")),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => categoriesClientApi.reorder({ orderedIds }),
    onSuccess: () => router.refresh(),
    onError: (err) => toast.error(errorMessage(err, "Could not reorder categories")),
  });

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorderMutation.mutate(ids);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="gradient" onClick={() => setEditing("new")}>
          New category
        </Button>
      </div>

      <Card variant="glass" className="flex flex-col divide-y divide-border p-0">
        {categories.map((category, index) => (
          <div key={category.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex flex-col">
              <span className="font-medium">{category.name}</span>
              <span className="text-sm text-muted-foreground">/{category.slug}</span>
              {category.description && <span className="text-sm text-muted-foreground">{category.description}</span>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => move(index, 1)} disabled={index === categories.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(category)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete "${category.name}"?`)) deleteMutation.mutate(category.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="p-4 text-muted-foreground">No categories yet.</p>}
      </Card>

      {editing && (
        <CategoryForm
          category={editing === "new" ? undefined : editing}
          open
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
