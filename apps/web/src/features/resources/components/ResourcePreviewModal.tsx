"use client";

import { useState } from "react";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";

const PREVIEWABLE_TYPES = new Set(["pdf", "video", "diagram"]);

export function ResourcePreviewModal({
  title,
  resourceType,
  fileUrl,
}: {
  title: string;
  resourceType: string;
  fileUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!fileUrl || !PREVIEWABLE_TYPES.has(resourceType)) return null;

  return (
    <>
      <Button variant="glass" onClick={() => setOpen(true)}>
        Preview
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {resourceType === "pdf" && <iframe src={fileUrl} className="h-[70vh] w-full rounded-md" title={title} />}
        {resourceType === "video" && <video src={fileUrl} controls className="w-full rounded-md" />}
        {resourceType === "diagram" && <img src={fileUrl} alt={title} className="w-full rounded-md" />}
      </Dialog>
    </>
  );
}
