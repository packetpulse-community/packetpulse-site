"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/http-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";
import { useFeatureFlag } from "@/features/feature-flags/hooks/useFeatureFlags";
import { privacyApi, privacyKeys } from "@/features/privacy/api/privacy.api";
import { resumeKeys, resumesApi } from "../api/resumes.api";
import { putFile, UploadAbortedError } from "../lib/upload-file";
import { resumeContentType, validateResumeFile, type UploadPhase } from "../lib/resume-logic";
import { CurrentResume } from "./CurrentResume";
import { DeleteResumeDialog } from "./DeleteResumeDialog";
import { EarlierVersions } from "./EarlierVersions";
import { ProfileEntriesPanel } from "./ProfileEntriesPanel";
import { ResumeSteps } from "./ResumeSteps";
import { SuggestionReview } from "./SuggestionReview";
import { UploadPanel } from "./UploadPanel";

function apiMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string } | null)?.message ?? fallback) : fallback;
}

const UPLOAD_FAILED = "The upload did not finish. Check your connection and try again.";

// SCR-012 resume review (TASK-024): upload with progress, the state of the current resume, review
// of what was read from it one field at a time, replace and delete. A failed read never blocks the
// profile: every state says what the member can do instead.
export function ResumeCentre() {
  const queryClient = useQueryClient();
  const { enabled: uploadsEnabled } = useFeatureFlag("resumes.upload");
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [resumeBusy, setResumeBusy] = useState<"open" | "retry" | "delete" | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; what: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [decideBusy, setDecideBusy] = useState<string | null>(null);
  const [decideErrors, setDecideErrors] = useState<Record<string, string>>({});
  const [entryBusy, setEntryBusy] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: resumeKeys.overview,
    queryFn: resumesApi.overview,
    // While we are reading the file, look again every couple of seconds.
    refetchInterval: (q) => (q.state.data?.current?.status === "parsing" ? 2000 : false),
  });
  const entries = useQuery({ queryKey: resumeKeys.entries, queryFn: resumesApi.entries });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: resumeKeys.overview }), queryClient.invalidateQueries({ queryKey: resumeKeys.entries })]);

  async function handleFile(file: File) {
    setUploadError(null);
    const problem = validateResumeFile(file);
    if (problem) return setUploadError(problem);
    const contentType = resumeContentType(file)!;
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: "uploading", name: file.name, percent: 0 });
    try {
      const start = await resumesApi.startUpload({ originalName: file.name, contentType, sizeBytes: file.size });
      await putFile(start.uploadUrl, file, contentType, (percent) => setPhase({ kind: "uploading", name: file.name, percent }), controller.signal);
      setPhase({ kind: "scanning", name: file.name });
      await resumesApi.complete(start.resume.id);
      await refresh();
      toast.success("Your resume is uploaded. We are reading it now.");
    } catch (err) {
      if (!(err instanceof UploadAbortedError)) setUploadError(err instanceof ApiError ? apiMessage(err, UPLOAD_FAILED) : UPLOAD_FAILED);
    } finally {
      abort.current = null;
      setPhase({ kind: "idle" });
      await refresh();
    }
  }

  const agree = useMutation({
    mutationFn: async () => {
      const mine = await privacyApi.myConsents();
      const item = mine.items.find((i) => i.purpose === "resume_sharing");
      if (!item) throw new Error("missing");
      return privacyApi.updateConsents({ changes: [{ purpose: "resume_sharing", action: "granted", policyVersion: item.policy.version }] });
    },
    onMutate: () => setConsentError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: privacyKeys.consents });
      await refresh();
    },
    onError: (err) => setConsentError(apiMessage(err, "We could not save your choice. Please try again.")),
  });

  async function open(id: string, scope: "current" | "history") {
    if (scope === "current") {
      setResumeBusy("open");
      setResumeError(null);
    } else {
      setHistoryBusy(id);
    }
    // The tab is opened inside the click (browsers block it after an await), then pointed at the
    // short-lived link once we have it.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const link = await resumesApi.link(id);
      if (tab) tab.location.href = link.url;
      else window.location.assign(link.url);
    } catch (err) {
      tab?.close();
      const message = apiMessage(err, "We could not open that file. Please try again.");
      if (scope === "current") setResumeError(message);
      else toast.error(message);
    } finally {
      setResumeBusy(null);
      setHistoryBusy(null);
    }
  }

  async function retry(id: string) {
    setResumeBusy("retry");
    setResumeError(null);
    try {
      await resumesApi.retry(id);
      await refresh();
    } catch (err) {
      setResumeError(apiMessage(err, "We could not start reading it again. Please try again."));
    } finally {
      setResumeBusy(null);
    }
  }

  const remove = useMutation({
    mutationFn: (id: string) => resumesApi.remove(id),
    onMutate: () => setDeleteError(null),
    onSuccess: async () => {
      setDeleting(null);
      await refresh();
      toast.success("Your resume was deleted.");
    },
    onError: (err) => setDeleteError(apiMessage(err, "We could not delete it. Please try again.")),
  });

  async function decide(id: string, decision: "accept" | "reject") {
    setDecideBusy(id);
    setDecideErrors((e) => ({ ...e, [id]: "" }));
    try {
      await resumesApi.decide(id, { decision });
      await refresh();
    } catch (err) {
      setDecideErrors((e) => ({ ...e, [id]: apiMessage(err, "We could not save that. Please try again.") }));
    } finally {
      setDecideBusy(null);
    }
  }

  async function removeEntry(kind: "education" | "experience", id: string) {
    setEntryBusy(id);
    setEntryError(null);
    try {
      await resumesApi.removeEntry(kind, id);
      await refresh();
    } catch (err) {
      setEntryError(apiMessage(err, "We could not remove it. Please try again."));
    } finally {
      setEntryBusy(null);
    }
  }

  if (overview.isPending) {
    return (
      <SkeletonScreen label="Loading your resume" className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </SkeletonScreen>
    );
  }
  if (overview.isError || !overview.data) {
    return <ErrorState title="We could not load your resume" description="Please try again in a moment." retry={{ label: "Try again", onClick: () => void overview.refetch() }} />;
  }
  const o = overview.data;
  const current = o.current;

  return (
    <div className="flex flex-col gap-6">
      <Card aria-labelledby="resume-title">
        <CardHeader>
          <CardTitle id="resume-title">Your resume</CardTitle>
          <CardDescription>
            Upload a PDF or Word file and we will suggest skills, education and experience for your profile. A resume is private: only you can open it
            {o.consentGranted ? ", and the PacketPulse team while you allow sharing" : ""}. Reading it is optional: you can always fill in your profile by hand.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ResumeSteps phase={phase} current={current} />
          {current && (
            <CurrentResume
              resume={current}
              busy={resumeBusy}
              canRetry={uploadsEnabled}
              error={resumeError}
              onOpen={() => void open(current.id, "current")}
              onRetry={() => void retry(current.id)}
              onDelete={() => (setDeleteError(null), setDeleting({ id: current.id, what: "your resume" }))}
            />
          )}
          <UploadPanel
            phase={phase}
            error={uploadError}
            enabled={uploadsEnabled}
            consentGranted={o.consentGranted}
            hasCurrent={!!current}
            agreeing={agree.isPending}
            consentError={consentError}
            onFile={(f) => void handleFile(f)}
            onCancel={() => abort.current?.abort()}
            onAgree={() => agree.mutate()}
          />
        </CardContent>
      </Card>

      {current && (current.status === "ready" || o.suggestions.length > 0) && (
        <Card aria-labelledby="review-title">
          <CardHeader>
            <CardTitle id="review-title">Review what we found</CardTitle>
            <CardDescription>Accept what is right and reject what is not. Accepted skills and details are added to your profile, and you can remove them later.</CardDescription>
          </CardHeader>
          <CardContent>
            <SuggestionReview suggestions={o.suggestions} busyId={decideBusy} errors={decideErrors} onDecide={(id, d) => void decide(id, d)} />
          </CardContent>
        </Card>
      )}

      <Card aria-labelledby="entries-title">
        <CardHeader>
          <CardTitle id="entries-title">Added from your resume</CardTitle>
          <CardDescription>Education and experience you accepted. Skills you accepted are on your profile page.</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.data ? (
            <ProfileEntriesPanel entries={entries.data} busyId={entryBusy} error={entryError} onRemove={(k, id) => void removeEntry(k, id)} />
          ) : (
            <p className="text-sm text-text-secondary">{entries.isError ? "We could not load these. Please refresh the page." : "Loading…"}</p>
          )}
        </CardContent>
      </Card>

      <Card aria-labelledby="history-title">
        <CardHeader>
          <CardTitle id="history-title">Earlier versions</CardTitle>
          <CardDescription>We keep your newest {o.maxVersions} versions. Delete any you no longer want.</CardDescription>
        </CardHeader>
        <CardContent>
          <EarlierVersions
            versions={o.history}
            busyId={historyBusy}
            onOpen={(id) => void open(id, "history")}
            onDelete={(id) => (setDeleteError(null), setDeleting({ id, what: `version ${o.history.find((h) => h.id === id)?.version ?? ""}`.trim() }))}
          />
        </CardContent>
      </Card>

      <DeleteResumeDialog
        open={!!deleting}
        what={deleting?.what ?? "your resume"}
        pending={remove.isPending}
        error={deleteError}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
