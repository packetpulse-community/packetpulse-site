import Link from "next/link";
import { BookOpen, FileText, UserCheck, Users, Video } from "lucide-react";
import { Card } from "@/shared/ui/primitives/Card";

interface QuickAccessGridProps {
  pendingApproval: number;
  pendingResources: number;
  pendingBlogs: number;
}

export function QuickAccessGrid({ pendingApproval, pendingResources, pendingBlogs }: QuickAccessGridProps) {
  const cards = [
    { label: "Users Management", description: "Manage users, roles and permissions", icon: Users, iconClass: "bg-indigo-500/10 text-indigo-500", href: "/admin/users" },
    {
      label: "Pending Approvals",
      description: `${pendingApproval} users waiting for approval`,
      icon: UserCheck,
      iconClass: "bg-yellow-500/15 text-yellow-600",
      href: "/admin/users?approved=false",
      badge: pendingApproval,
    },
    {
      label: "Pending Resources",
      description: `${pendingResources} resources awaiting approval`,
      icon: FileText,
      iconClass: "bg-yellow-500/15 text-yellow-600",
      href: "/admin/resources",
      badge: pendingResources,
    },
    { label: "Recordings Management", description: "Manage video recordings and tutorials", icon: Video, iconClass: "bg-green-500/15 text-green-600", href: "/admin/recordings" },
    { label: "Blogs Management", description: "Manage blog posts and articles", icon: BookOpen, iconClass: "bg-cyan-400/15 text-cyan-400", href: "/admin/blogs", badge: pendingBlogs },
    { label: "Resources Management", description: "Manage learning resources and files", icon: FileText, iconClass: "bg-yellow-500/15 text-yellow-600", href: "/admin/resources" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.label} href={card.href}>
            <Card className="relative flex h-full flex-col gap-3 p-5 transition-shadow hover:border-indigo-500/50 hover:shadow-md">
              {!!card.badge && card.badge > 0 && (
                <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                  {card.badge}
                </span>
              )}
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${card.iconClass}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">{card.label}</p>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
