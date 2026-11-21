import Link from "next/link";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

interface PendingBannerProps {
  icon: React.ReactNode;
  message: string;
  href: string;
  cta: string;
}

export function PendingBanner({ icon, message, href, cta }: PendingBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
      <div className="flex items-center gap-3 text-sm text-foreground">
        {icon}
        {message}
      </div>
      <Link
        href={href}
        className={cn(buttonVariants({ size: "sm" }), "bg-warning text-surface hover:bg-warning/90")}
      >
        {cta}
      </Link>
    </div>
  );
}
