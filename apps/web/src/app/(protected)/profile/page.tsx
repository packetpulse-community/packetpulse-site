import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/primitives/Card";
import { EditProfileForm } from "@/features/profile/components/EditProfileForm";
import { ChangePasswordForm } from "@/features/profile/components/ChangePasswordForm";
import { DangerZoneCard } from "@/features/profile/components/DangerZoneCard";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account details and security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <EditProfileForm user={user} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Choose a strong password you don&apos;t use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <DangerZoneCard />
    </div>
  );
}
