import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { DataRightsCentre } from "@/features/data-rights/components/DataRightsCentre";

export const metadata = { title: "Your data" };

// SCR-038: download my data, correct, withdraw consent, delete my account and data. Reachable while
// the account is waiting out its deletion grace period (it is the one page that works then).
export default async function DataRightsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Your data</h1>
        <p className="text-muted-foreground">Download a copy of your data, or delete your account. Both are logged, and you are told by email.</p>
      </div>
      <DataRightsCentre />
    </div>
  );
}
