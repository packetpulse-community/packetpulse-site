import type { LucideIcon } from "lucide-react";
import { Card } from "@/shared/ui/primitives/Card";

export function DashboardStatCard({ title, value, icon: Icon }: { title: string; value: number; icon: LucideIcon }) {
  return (
    <Card variant="glass" className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
    </Card>
  );
}
