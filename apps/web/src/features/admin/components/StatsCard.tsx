import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  highlight?: boolean;
  href?: string;
}

export function StatsCard({ title, value, icon: Icon, highlight = false, href }: StatsCardProps) {
  const content = (
    <Card
      className={cn(
        "flex h-full flex-col gap-3 p-4 transition-shadow",
        highlight ? "border-2 border-warning" : "hover:shadow-md",
        href && "hover:border-primary/50",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            highlight ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </div>
      {highlight && value > 0 && (
        <Badge variant="warning" className="w-fit">
          Requires attention
        </Badge>
      )}
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
