import { getCurrentUser } from "@/shared/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Welcome, {user?.firstName}</h1>
      <p className="text-muted-foreground">
        {user?.isApproved ? "Your account is approved." : "Your account is pending admin approval."}
      </p>
    </div>
  );
}
