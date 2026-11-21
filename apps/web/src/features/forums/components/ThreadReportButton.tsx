"use client";

import { useState } from "react";
import { useAuth } from "@/shared/auth/AuthProvider";
import { Button } from "@/shared/ui/primitives/Button";
import { forumsClientApi } from "../api/forums.api";
import { ReportDialog } from "./ReportDialog";

export function ThreadReportButton({ threadId, authorId }: { threadId: string; authorId: string }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  if (!auth || auth.id === authorId) return null;
  return (
    <>
      <Button variant="glass" size="sm" onClick={() => setOpen(true)}>
        Report
      </Button>
      <ReportDialog open={open} onClose={() => setOpen(false)} what="thread" onSubmit={(dto) => forumsClientApi.reportThread(threadId, dto)} />
    </>
  );
}
