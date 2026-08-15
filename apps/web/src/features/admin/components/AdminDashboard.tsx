"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, FileText, ShieldCheck, UserCheck, Users, UserPlus } from "lucide-react";
import { adminClientApi, type AdminDateRangeQuery } from "../api/admin.api";
import { StatsCard } from "./StatsCard";
import { DashboardDateFilter } from "./DashboardDateFilter";
import { PendingBanner } from "./PendingBanner";
import { QuickAccessGrid } from "./QuickAccessGrid";
import { UserGrowthChart } from "./UserGrowthChart";
import { ActivityDistributionChart } from "./ActivityDistributionChart";
import { UserDistributionBars } from "./UserDistributionBars";
import { RecentUsersTable } from "./RecentUsersTable";
import { RecentActivityTable } from "./RecentActivityTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";

export function AdminDashboard() {
  const [range, setRange] = useState<AdminDateRangeQuery>({});

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats", range],
    queryFn: () => adminClientApi.stats(range),
  });
  const { data: analytics } = useQuery({
    queryKey: ["admin", "analytics", range],
    queryFn: () => adminClientApi.analytics(range),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin Access
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground">Overview of your system&rsquo;s performance and activity</p>
      </div>

      <DashboardDateFilter value={range} onApply={setRange} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} />
        <StatsCard title="Active Users" value={stats?.activeUsers ?? 0} icon={UserCheck} />
        <StatsCard title="New Users" value={stats?.newUsers ?? 0} icon={UserPlus} />
        <StatsCard
          title="Pending Approvals"
          value={stats?.pendingApproval ?? 0}
          icon={ShieldCheck}
          highlight={(stats?.pendingApproval ?? 0) > 0}
          href="/admin/users?approved=false"
        />
      </div>

      <div className="flex flex-col gap-3">
        {!!stats?.pendingApproval && (
          <PendingBanner
            icon={<UserCheck className="h-4 w-4 text-yellow-500" />}
            message={`${stats.pendingApproval} users waiting for approval`}
            href="/admin/users?approved=false"
            cta="Review Now"
          />
        )}
        {!!stats?.pendingResources && (
          <PendingBanner
            icon={<FileText className="h-4 w-4 text-yellow-500" />}
            message={`${stats.pendingResources} resources waiting for approval`}
            href="/admin/resources"
            cta="Review Resources"
          />
        )}
        {!!stats?.pendingBlogs && (
          <PendingBanner
            icon={<BookOpen className="h-4 w-4 text-yellow-500" />}
            message={`${stats.pendingBlogs} blog posts waiting for approval`}
            href="/admin/blogs"
            cta="Review Blogs"
          />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Quick Access</h2>
        <QuickAccessGrid
          pendingApproval={stats?.pendingApproval ?? 0}
          pendingResources={stats?.pendingResources ?? 0}
          pendingBlogs={stats?.pendingBlogs ?? 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" /> User Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserGrowthChart data={analytics?.registrationTrend ?? []} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityDistributionChart data={analytics?.activityDistribution ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <UserDistributionBars data={analytics?.roleDistribution ?? []} />
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="text-xl font-semibold text-foreground">{stats?.totalUsers ?? 0}</span> Total Registered
              Users
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Users</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentUsersTable />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivityTable />
        </CardContent>
      </Card>
    </div>
  );
}
