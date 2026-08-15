"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/primitives/Button";
import { adminClientApi } from "../api/admin.api";

export function BlogApproveButton({ blogId }: { blogId: string }) {
  const [done, setDone] = useState(false);
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => adminClientApi.approveBlog(blogId),
    onSuccess: () => {
      setDone(true);
      toast.success("Blog post approved");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to approve blog post"),
  });

  if (done) return <span className="text-sm text-muted-foreground">Approved</span>;

  return (
    <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending ? "Approving…" : "Approve"}
    </Button>
  );
}
