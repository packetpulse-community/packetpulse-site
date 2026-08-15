import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { UserGrowthChart } from "@/features/admin/components/UserGrowthChart";
import { ActivityDistributionChart } from "@/features/admin/components/ActivityDistributionChart";

export default async function AdminAnalyticsPage() {
  const cookieHeader = (await cookies()).toString();
  const analytics = await adminServerApi.analytics(cookieHeader);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <Card>
        <CardHeader>
          <CardTitle>Role distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {analytics.roleDistribution.map((r) => (
            <div key={r.role} className="rounded-lg border border-border bg-background px-4 py-3">
              <p className="text-xl font-semibold">{r.count}</p>
              <Badge variant="secondary" className="mt-1">
                {r.role}
              </Badge>
            </div>
          ))}
          {analytics.roleDistribution.length === 0 && (
            <p className="text-muted-foreground">No role data available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrations (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <UserGrowthChart data={analytics.registrationTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityDistributionChart data={analytics.activityDistribution} />
        </CardContent>
      </Card>
    </div>
  );
}
