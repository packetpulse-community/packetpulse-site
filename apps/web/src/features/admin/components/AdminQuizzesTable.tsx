"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { quizzesClientApi, type QuizSummary } from "@/features/quizzes/api/quizzes.api";

export function AdminQuizzesTable({ quizzes }: { quizzes: QuizSummary[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<QuizSummary | null>(null);

  const publishMutation = useMutation({
    mutationFn: (q: QuizSummary) => quizzesClientApi.updateQuiz(q.id, { isPublished: !q.isPublished }),
    onSuccess: (_, q) => {
      toast.success(q.isPublished ? "Quiz unpublished" : "Quiz published");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update quiz"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quizzesClientApi.deleteQuiz(id),
    onSuccess: () => {
      toast.success("Quiz deleted");
      router.refresh();
      setDeleting(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete quiz"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link href="/quizzes/new" className="inline-flex">
          <Button variant="gradient">Create Quiz</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} variant="glass" className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{quiz.title}</p>
                <Badge variant={quiz.isPublished ? "success" : "warning"}>{quiz.isPublished ? "Published" : "Draft"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {quiz.category} · pass at {quiz.passingScorePct}% · {quiz._count.questions} questions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={() => publishMutation.mutate(quiz)} disabled={publishMutation.isPending}>
                {quiz.isPublished ? "Unpublish" : "Publish"}
              </Button>
              <Link href={`/quizzes/${quiz.id}/edit`} className="inline-flex">
                <Button variant="glass" size="sm">
                  Edit
                </Button>
              </Link>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(quiz)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {quizzes.length === 0 && <p className="text-muted-foreground">No quizzes found.</p>}
      </div>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete quiz" description="This action cannot be undone.">
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-medium text-foreground">{deleting?.title}</span> and all attempts/certificates for it?
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
