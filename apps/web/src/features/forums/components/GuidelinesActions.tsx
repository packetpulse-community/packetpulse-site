"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FORUM_REASON_MIN } from "@packetpulse/types";
import { useAuth } from "@/shared/auth/AuthProvider";
import { Button } from "@/shared/ui/primitives/Button";
import { forumErrorMessage, forumsClientApi } from "../api/forums.api";
import type { ForumGuidelinesStatus } from "../api/forums.api";
import { GUIDELINES_STATUS_KEY } from "./NewThreadForm";

// Acceptance (shown once, before the first post) and, for admins, the editor that publishes a
// new version. Both show their errors inline.
export function GuidelinesActions({ status }: { status: ForumGuidelinesStatus | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const auth = useAuth();
  const canEdit = auth?.roles.includes("super_admin") || auth?.permissions.includes("admin:manage-settings");
  const [accepted, setAccepted] = useState(status ? !status.mustAccept : false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await forumsClientApi.acceptGuidelines();
      setAccepted(true);
      qc.invalidateQueries({ queryKey: GUIDELINES_STATUS_KEY });
    } catch (e) {
      setError(forumErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 50) return setEditError("The guidelines need at least 50 characters.");
    if (reason.trim().length < FORUM_REASON_MIN) return setEditError(`Give a reason of at least ${FORUM_REASON_MIN} characters.`);
    setBusy(true);
    setEditError(null);
    try {
      await forumsClientApi.publishGuidelines({ body: body.trim(), reason: reason.trim() });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setEditError(forumErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {status &&
        (accepted ? (
          <p role="status">✓ You accepted the community guidelines{status.acceptedAt ? ` on ${new Date(status.acceptedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}` : ""}.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Button onClick={accept} disabled={busy} className="w-fit">
              {busy ? "Saving…" : "I accept the community guidelines"}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-danger">
                ⚠ {error}
              </p>
            )}
          </div>
        ))}

      {canEdit && !editing && (
        <Button variant="outline" onClick={() => setEditing(true)} className="w-fit">
          Publish a new version
        </Button>
      )}
      {canEdit && editing && (
        <form onSubmit={publish} noValidate className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
          <label htmlFor="guidelines-body" className="text-sm font-medium">
            New text (one rule per line)
          </label>
          <textarea id="guidelines-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" />
          <label htmlFor="guidelines-reason" className="text-sm font-medium">
            Reason for the change (recorded in the audit log)
          </label>
          <input id="guidelines-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" />
          {editError && (
            <p role="alert" className="text-sm text-danger">
              ⚠ {editError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Publishing…" : "Publish version"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
