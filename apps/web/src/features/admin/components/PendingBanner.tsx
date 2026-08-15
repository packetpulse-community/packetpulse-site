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
    <div className="flex items-center justify-between rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
      <div className="flex items-center gap-3 text-sm text-foreground">
        {icon}
        {message}
      </div>
      <Link
        href={href}
        className={cn(buttonVariants({ size: "sm" }), "bg-yellow-500 text-white hover:bg-yellow-600")}
      >
        {cta}
      </Link>
    </div>
  );
}
