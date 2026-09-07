import Link from "next/link";
import { cookies } from "next/headers";
import { BookOpen, FileText, MessageSquare, Users, Video, Wifi, Activity, Radar, Search, Shield } from "lucide-react";
import { getCurrentUser } from "@/shared/auth/session";
import { dashboardServerApi } from "@/features/dashboard/api/dashboard.api";
import { DashboardStatCard } from "@/features/dashboard/components/DashboardStatCard";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";

const NETWORK_TOOLS = [
  { label: "Ping Test", description: "Test connectivity to a host", tool: "ping", icon: Activity },
  { label: "Trace Route", description: "Show the path to a target host", tool: "traceroute", icon: Radar },
  { label: "DNS Lookup", description: "Look up DNS records", tool: "dns", icon: Search },
  { label: "Port Scanner", description: "Scan for open ports", tool: "port-scan", icon: Shield },
] as const;

export default async function DashboardPage() {
  const cookieHeader = (await cookies()).toString();
  const [user, stats] = await Promise.all([getCurrentUser(), dashboardServerApi.stats(cookieHeader)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user?.firstName}</h1>
        <p className="text-muted-foreground">
          {user?.isApproved ? "Your account is approved." : "Your account is pending admin approval."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <DashboardStatCard title="Blogs" value={stats.real.totalBlogPosts} icon={BookOpen} />
        <DashboardStatCard title="Resources" value={stats.real.totalResources} icon={FileText} />
        <DashboardStatCard title="Recordings" value={stats.real.totalRecordings} icon={Video} />
        <DashboardStatCard title="Forum Threads" value={stats.real.totalForumThreads} icon={MessageSquare} />
        <DashboardStatCard title="Members" value={stats.real.totalUsers} icon={Users} />
        <DashboardStatCard title="Online Now" value={stats.real.onlineCount} icon={Wifi} />
      </div>

      <Card variant="glass" className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Network Snapshot</h2>
          <Badge variant="glass">Simulated</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xl font-semibold">{stats.simulated.uptimePct}%</p>
            <p className="text-xs text-muted-foreground">Uptime</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{stats.simulated.networks}</p>
            <p className="text-xs text-muted-foreground">Networks</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{stats.simulated.devicesMonitored}</p>
            <p className="text-xs text-muted-foreground">Devices monitored</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{stats.simulated.activeAlerts}</p>
            <p className="text-xs text-muted-foreground">Active alerts</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Network Tools</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {NETWORK_TOOLS.map((t) => (
            <Link key={t.tool} href={`/network-tools?tool=${t.tool}`} className="glass-panel glass-interactive flex flex-col items-center gap-2 rounded-lg p-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                <t.icon className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
