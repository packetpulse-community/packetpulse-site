"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PROFILE_PRIVACY_FIELDS,
  PROFILE_PRIVACY_FIELD_META,
  type ProfilePrivacyField,
  type ProfilePrivacyView,
  type ProfileVisibilityLevel,
} from "@packetpulse/types";
import { privacyApi, privacyKeys } from "../api/privacy.api";
import { ApiError, apiFieldErrors } from "@/shared/api/http-client";
import { Button } from "@/shared/ui/primitives/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

const LEVEL_LABEL: Record<ProfileVisibilityLevel, { title: string; hint: string }> = {
  private: { title: "Only me and PacketPulse staff", hint: "Other members cannot see it." },
  members: { title: "Signed-in members", hint: "Any approved member can see it on your profile." },
};

type Draft = Record<ProfilePrivacyField, ProfileVisibilityLevel>;

// SCR-012 (privacy part): who can see each profile field. Default is private (DEC-015, PRD-052);
// there is no public option. Enforced by the server: this form only records the choice.
export function ProfileVisibilityForm() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: privacyKeys.visibility, queryFn: privacyApi.getVisibility });

  if (isPending) {
    return (
      <SkeletonScreen label="Loading your profile privacy settings" className="flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />
      </SkeletonScreen>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="We could not load your privacy settings."
        description="Check your connection and try again. Nothing was changed."
        retry={{ label: "Try again", onClick: () => void refetch() }}
      />
    );
  }
  return <VisibilityBody view={data} />;
}

function VisibilityBody({ view }: { view: ProfilePrivacyView }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(view.settings);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rootError, setRootError] = useState("");

  // A refetch (or a save elsewhere) replaces the baseline.
  useEffect(() => setDraft(view.settings), [view]);
  const dirty = PROFILE_PRIVACY_FIELDS.some((f) => draft[f] !== view.settings[f]);

  const save = useMutation({
    mutationFn: () => {
      const changed = Object.fromEntries(PROFILE_PRIVACY_FIELDS.filter((f) => draft[f] !== view.settings[f]).map((f) => [f, draft[f]]));
      return privacyApi.updateVisibility(changed);
    },
    onMutate: () => {
      setFieldErrors({});
      setRootError("");
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(privacyKeys.visibility, updated);
      toast.success("Privacy settings saved.");
    },
    // Entered choices stay on screen when the save fails.
    onError: (err) => {
      const fields = apiFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) {
        setRootError(err instanceof ApiError ? ((err.body as { message?: string } | null)?.message ?? "") || "Could not save your settings. Try again." : "Could not save your settings. Try again.");
      }
    },
  });

  return (
    <Card id="visibility">
      <CardHeader>
        <CardTitle>Who can see your profile</CardTitle>
        <CardDescription>
          Everything starts private. PacketPulse staff can always see your profile to run the community. Your name and photo are shown next to your posts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) save.mutate();
          }}
          className="flex flex-col gap-5"
          noValidate
        >
          {PROFILE_PRIVACY_FIELDS.map((field) => {
            const meta = PROFILE_PRIVACY_FIELD_META[field];
            const errId = `visibility-err-${field}`;
            return (
              <fieldset key={field} className="flex flex-col gap-2" aria-describedby={fieldErrors[field] ? errId : undefined}>
                <legend className="font-medium">{meta.label}</legend>
                <p className="text-sm text-text-secondary">{meta.description}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                  {(["private", "members"] as const).map((level) => {
                    const id = `visibility-${field}-${level}`;
                    return (
                      <div key={level} className="flex items-start gap-2 text-sm">
                        <input
                          id={id}
                          type="radio"
                          name={`visibility-${field}`}
                          value={level}
                          checked={draft[field] === level}
                          onChange={() => setDraft((d) => ({ ...d, [field]: level }))}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <label htmlFor={id} className="flex flex-col">
                          <span className="font-medium">{LEVEL_LABEL[level].title}</span>
                          <span className="text-xs text-text-secondary">{LEVEL_LABEL[level].hint}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
                {fieldErrors[field] && (
                  <p id={errId} role="alert" className="text-sm text-danger">
                    {fieldErrors[field]}
                  </p>
                )}
              </fieldset>
            );
          })}

          <div className="rounded-grove-control border border-border bg-surface-subtle p-3 text-sm">
            <p className="font-medium">Always private</p>
            <p className="text-text-secondary">
              {view.alwaysPrivate.map((f) => f.label).join(" and ")} are never shown to other members, whatever you choose above.
            </p>
          </div>

          {rootError && (
            <p role="alert" className="text-sm text-danger">
              {rootError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={save.isPending} disabled={!dirty && !save.isPending}>
              Save privacy settings
            </Button>
            {!dirty && view.updatedAt && (
              <span className="text-xs text-text-secondary">
                Last saved <time dateTime={view.updatedAt}>{new Date(view.updatedAt).toLocaleString("en-IN")}</time>
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
