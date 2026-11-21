import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/primitives/Card";
import { buttonVariants } from "@/shared/ui/primitives/Button";

// Deleting an account is no longer a one-click dialog: it has a password step, a 30-day grace
// period and a list of what is erased (TASK-046, SCR-038), all on the data-rights page.
export function DangerZoneCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data and account deletion</CardTitle>
        <CardDescription>Download a copy of your data, or delete your account. Deletion waits 30 days so you can change your mind.</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/settings/data-rights" className={buttonVariants({ variant: "secondary" })}>
          Open your data
        </Link>
      </CardContent>
    </Card>
  );
}
