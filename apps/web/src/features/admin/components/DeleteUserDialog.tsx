"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";
import { adminClientApi, type AdminUser } from "../api/admin.api";

interface DeleteUserDialogProps {
  user: AdminUser | null;
  onClose: () => void;
}

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => adminClientApi.deleteUser(user!.id),
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    },
  });

  if (!user) return null;

  return (
    <Dialog open={!!user} onClose={onClose} title="Delete user" description="This action cannot be undone.">
      <p className="text-sm text-muted-foreground">
        Are you sure you want to permanently delete{" "}
        <span className="font-medium text-foreground">
          {user.firstName} {user.lastName}
        </span>{" "}
        ({user.email})?
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Deleting…" : "Delete user"}
        </Button>
      </div>
    </Dialog>
  );
}
