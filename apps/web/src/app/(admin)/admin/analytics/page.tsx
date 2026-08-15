import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";

export default async function AdminAnalyticsPage() {
  const cookieHeader = (await cookies()).toString();
  const analytics = await adminServerApi.analytics(cookieHeader);

  const max = Math.max(...analytics.registrationTrend.map((p) => p.count), 1);
  const labelEvery = Math.max(1, Math.ceil(analytics.registrationTrend.length / 8));

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
          {analytics.registrationTrend.length === 0 ? (
            <p className="text-muted-foreground">No registrations in this window.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Daily registrations</span>
                <span>Max: {max}</span>
              </div>
              <div className="flex items-end gap-1" style={{ height: 160 }}>
                {analytics.registrationTrend.map((point) => (
                  <div
                    key={point.date}
                    title={`${point.date}: ${point.count}`}
                    className="flex-1 rounded-t bg-primary transition-all hover:bg-primary/80"
                    style={{ height: `${(point.count / max) * 100}%`, minHeight: 2 }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                {analytics.registrationTrend.map((point, i) => (
                  <span key={point.date} className="flex-1 text-center">
                    {i % labelEvery === 0 ? point.date.slice(5) : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
