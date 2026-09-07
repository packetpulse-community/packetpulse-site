"use client";

import { toast } from "sonner";
import { Button, buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

export function ShareButtons({ title, url }: { title: string; url: string }) {
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  }

  return (
    <div className="flex items-center gap-2">
      <a href={twitterUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "glass", size: "sm" }))}>
        Share on X
      </a>
      <a href={linkedinUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "glass", size: "sm" }))}>
        Share on LinkedIn
      </a>
      <Button variant="glass" size="sm" onClick={copyLink}>
        Copy link
      </Button>
    </div>
  );
}
