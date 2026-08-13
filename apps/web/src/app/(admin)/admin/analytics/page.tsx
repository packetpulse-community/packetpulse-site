import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";

export default async function AdminAnalyticsPage() {
  const cookieHeader = (await cookies()).toString();
  const analytics = await adminServerApi.analytics(cookieHeader);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Role distribution</h2>
        <div className="flex flex-wrap gap-3">
          {analytics.roleDistribution.map((r) => (
            <div key={r.role} className="rounded-lg border border-border bg-card px-4 py-3 text-card-foreground">
              <p className="text-xl font-semibold">{r.count}</p>
              <p className="text-xs text-muted-foreground">{r.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Registrations (last 30 days)</h2>
        {analytics.registrationTrend.length === 0 ? (
          <p className="text-muted-foreground">No registrations in this window.</p>
        ) : (
          <div className="flex items-end gap-1 rounded-lg border border-border bg-card p-4" style={{ height: 160 }}>
            {analytics.registrationTrend.map((point) => {
              const max = Math.max(...analytics.registrationTrend.map((p) => p.count), 1);
              return (
                <div
                  key={point.date}
                  title={`${point.date}: ${point.count}`}
                  className="flex-1 rounded-t bg-primary"
                  style={{ height: `${(point.count / max) * 100}%`, minHeight: 2 }}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
