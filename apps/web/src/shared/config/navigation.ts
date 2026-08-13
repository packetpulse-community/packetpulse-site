// Cross-domain navigation index feeding the command palette (plan §6) — the
// primary way users move between domains, instead of a persistent nested sidebar.
export interface NavCommand {
  label: string;
  href: string;
  group: string;
  keywords?: string[];
}

export const navCommands: NavCommand[] = [
  { label: "Dashboard", href: "/dashboard", group: "Go to" },
  { label: "Blogs", href: "/blogs", group: "Go to" },
  { label: "Resources", href: "/resources", group: "Go to" },
  { label: "Recordings", href: "/recordings", group: "Go to" },
  { label: "Forums", href: "/forums", group: "Go to" },
  { label: "Quizzes", href: "/quizzes", group: "Go to" },
  { label: "My certificates", href: "/certificates", group: "Go to" },
  { label: "Profile settings", href: "/profile", group: "Go to" },

  { label: "New forum thread", href: "/forums", group: "Create", keywords: ["ask", "discuss", "post"] },
  { label: "Try a quiz", href: "/quizzes", group: "Create", keywords: ["attempt", "test"] },

  { label: "Pending user approvals", href: "/admin/users", group: "Admin", keywords: ["approve"] },
  { label: "Moderate resources", href: "/admin/resources", group: "Admin", keywords: ["moderate", "pending"] },
  { label: "Analytics", href: "/admin/analytics", group: "Admin", keywords: ["stats", "dashboard"] },
];
