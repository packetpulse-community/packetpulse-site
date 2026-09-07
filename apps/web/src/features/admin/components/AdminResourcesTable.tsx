"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { adminClientApi } from "../api/admin.api";
import { resourcesClientApi, type ResourceSummary } from "@/features/resources/api/resources.api";
import { ResourceForm } from "./ResourceForm";

export function AdminResourcesTable({ resources }: { resources: ResourceSummary[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ResourceSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ResourceSummary | null>(null);

  const approveMutation = useMutation({
    mutationFn: (r: ResourceSummary) =>
      r.isApproved ? adminClientApi.unapproveResource(r.id) : adminClientApi.approveResource(r.id),
    onSuccess: (_, r) => {
      toast.success(r.isApproved ? "Resource unapproved" : "Resource approved");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update approval"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => resourcesClientApi.delete(id),
    onSuccess: () => {
      toast.success("Resource deleted");
      router.refresh();
      setDeleting(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete resource"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="gradient" onClick={() => setCreating(true)}>
          Create Resource
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {resources.map((resource) => (
          <Card key={resource.id} variant="glass" className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{resource.title}</p>
                <Badge variant={resource.isApproved ? "success" : "warning"}>
                  {resource.isApproved ? "Approved" : "Pending"}
                </Badge>
                {resource.premium && <Badge variant="glass">Premium</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {resource.resourceType} · {resource.category} · {resource.user.firstName} {resource.user.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={() => approveMutation.mutate(resource)} disabled={approveMutation.isPending}>
                {resource.isApproved ? "Unapprove" : "Approve"}
              </Button>
              <Button variant="glass" size="sm" onClick={() => setEditing(resource)}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(resource)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {resources.length === 0 && <p className="text-muted-foreground">No resources found.</p>}
      </div>

      {(editing || creating) && (
        <ResourceForm
          resource={editing ?? undefined}
          open={true}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete resource"
        description="This action cannot be undone."
      >
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-medium text-foreground">{deleting?.title}</span>?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
