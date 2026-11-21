import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { ResumeCentre } from "@/features/resumes/components/ResumeCentre";

export const metadata = { title: "Your resume" };

// SCR-012 resume review (TASK-024): upload, see the state, review the suggestions, replace or delete.
export default async function ResumePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Your resume</h1>
        <p className="text-muted-foreground">Upload your resume, check what we read from it, and choose what goes on your profile.</p>
      </div>
      <ResumeCentre />
    </div>
  );
}
