"use client";

import { toast } from "sonner";
import { Button } from "@/shared/ui/primitives/Button";

export function CopyVerifyLinkButton({ certificateNumber }: { certificateNumber: string }) {
  async function copyLink() {
    const url = `${window.location.origin}/certificates/verify/${certificateNumber}`;
    await navigator.clipboard.writeText(url);
    toast.success("Verify link copied to clipboard");
  }

  return (
    <Button variant="glass" size="sm" onClick={copyLink}>
      Copy verify link
    </Button>
  );
}
