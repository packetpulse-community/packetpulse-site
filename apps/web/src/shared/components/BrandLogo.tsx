import Image from "next/image";
import { cn } from "@/shared/utils/cn";

// The logo artwork is white lettering on transparent, so it only reads on a dark ground. On the
// light theme it sits on the Grove deep-teal tile (Document 2: dark panels), in dark mode the tile
// blends into the page. Same markup in both modes, so there is nothing to flash.
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("inline-flex items-center rounded-grove-control bg-grove-teal px-2.5 py-1.5", className)}>
      <Image src="/logo.png" alt="PacketPulse" width={140} height={54} className="h-7 w-auto" priority={priority} />
    </span>
  );
}
