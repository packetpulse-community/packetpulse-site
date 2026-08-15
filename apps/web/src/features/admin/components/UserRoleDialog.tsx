"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";
import { adminClientApi, type AdminUser } from "../api/admin.api";

// No GET /admin/roles endpoint exists — hardcoded from the seeded role names
// in apps/backend/prisma/seed.ts. Stopgap until a roles-listing endpoint exists.
const KNOWN_ROLES = ["member", "moderator", "instructor", "admin", "super_admin"] as const;

interface UserRoleDialogProps {
  user: AdminUser | null;
  onClose: () => void;
}

export function UserRoleDialog({ user, onClose }: UserRoleDialogProps) {
  const [selected, setSelected] = useState<string[]>(user?.roles ?? []);

  // The dialog stays mounted between opens (only the `user` prop changes), so the
  // initial useState above only captures roles on the very first render — reset
  // whenever a different user's dialog is opened.
  useEffect(() => {
    setSelected(user?.roles ?? []);
  }, [user]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (roleNames: string[]) => adminClientApi.assignRoles(user!.id, { roleNames }),
    onSuccess: () => {
      toast.success("Roles updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update roles");
    },
  });

  if (!user) return null;

  function toggleRole(role: string) {
    setSelected((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  return (
    <Dialog
      open={!!user}
      onClose={onClose}
      title="Manage roles"
      description={`${user.firstName} ${user.lastName} (${user.email})`}
    >
      <div className="flex flex-col gap-2">
        {KNOWN_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            <input
              type="checkbox"
              checked={selected.includes(role)}
              onChange={() => toggleRole(role)}
              className="h-4 w-4 rounded border-input"
            />
            {role}
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate(selected)} disabled={mutation.isPending || selected.length === 0}>
          {mutation.isPending ? "Saving…" : "Save roles"}
        </Button>
      </div>
    </Dialog>
  );
}
