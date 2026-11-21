import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/primitives/Card";
import { EditProfileForm } from "@/features/profile/components/EditProfileForm";
import { ChangePasswordForm } from "@/features/profile/components/ChangePasswordForm";
import { DangerZoneCard } from "@/features/profile/components/DangerZoneCard";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { skillsServerApi } from "@/features/skills/api/skills.api";
import { forumsServerApi } from "@/features/forums/api/forums.api";
import { ReputationLine } from "@/features/forums/components/ReputationLine";
import { SkillPicker } from "@/features/skills/components/SkillPicker";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const cookieHeader = (await cookies()).toString();
  // Skills need an approved, verified account; the profile page itself is open to everyone, so a
  // refusal here just hides the skills card instead of failing the page.
  const reputation = await forumsServerApi.reputation(user.id, cookieHeader).catch(() => null);
  const skills = await Promise.all([skillsServerApi.taxonomy(), skillsServerApi.mine(cookieHeader)]).catch(() => null);

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

      {reputation && (
        <Card>
          <CardHeader>
            <CardTitle>Community reputation</CardTitle>
            <CardDescription>Earned from accepted and helpful answers in the forums, not from how much you post.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold" data-testid="profile-reputation">
              {reputation.points} points · {reputation.level}
            </p>
            <p className="text-sm text-muted-foreground">
              <ReputationLine reputation={reputation} />
            </p>
          </CardContent>
        </Card>
      )}

      {skills && (
      <Card>
        <CardHeader>
          <CardTitle>Your Skills</CardTitle>
          <CardDescription>
            Pick the skills you have. They are shown as self declared until you add evidence. You choose who sees each one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkillPicker taxonomy={skills[0].skills} initial={skills[1]} />
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Privacy and consent</CardTitle>
          <CardDescription>Choose who can see your profile, and review or withdraw the consents you have given.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/privacy" className={buttonVariants({ variant: "secondary" })}>
            Open privacy and consent
          </Link>
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
