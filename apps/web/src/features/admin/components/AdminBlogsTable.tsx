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
import { blogsClientApi, type BlogPostSummary } from "@/features/blogs/api/blogs.api";
import { BlogForm } from "./BlogForm";

export function AdminBlogsTable({ posts }: { posts: BlogPostSummary[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BlogPostSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BlogPostSummary | null>(null);

  const approveMutation = useMutation({
    mutationFn: (p: BlogPostSummary) => (p.isApproved ? adminClientApi.unapproveBlog(p.id) : adminClientApi.approveBlog(p.id)),
    onSuccess: (_, p) => {
      toast.success(p.isApproved ? "Post unapproved" : "Post approved");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update approval"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blogsClientApi.delete(id),
    onSuccess: () => {
      toast.success("Post deleted");
      router.refresh();
      setDeleting(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete post"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="gradient" onClick={() => setCreating(true)}>
          Create Post
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {posts.map((post) => (
          <Card key={post.id} variant="glass" className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{post.title}</p>
                <Badge variant={post.isApproved ? "success" : "warning"}>{post.isApproved ? "Approved" : "Pending"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {post.category} · {post.author.firstName} {post.author.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={() => approveMutation.mutate(post)} disabled={approveMutation.isPending}>
                {post.isApproved ? "Unapprove" : "Approve"}
              </Button>
              <Button variant="glass" size="sm" onClick={() => setEditing(post)}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(post)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {posts.length === 0 && <p className="text-muted-foreground">No blog posts found.</p>}
      </div>

      {(editing || creating) && (
        <BlogForm
          post={editing ?? undefined}
          open={true}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete post" description="This action cannot be undone.">
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-medium text-foreground">{deleting?.title}</span>?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
