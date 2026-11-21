"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MyConsentItem, MyConsentView } from "@packetpulse/types";
import { privacyApi, privacyKeys } from "../api/privacy.api";
import { statusText, historyText, formatConsentTime } from "../lib/consent-logic";
import { ApiError } from "@/shared/api/http-client";
import { Button } from "@/shared/ui/primitives/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";
import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";
import { StatusChip, type StatusTone } from "@/shared/ui/primitives/StatusChip";

function apiMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string } | null)?.message ?? fallback) : fallback;
}

const chip = (i: MyConsentItem): { tone: StatusTone; text: string } => {
  if (i.needsAction) return { tone: "warning", text: "Needs your review" };
  if (i.status === "granted") return { tone: "success", text: i.outdated ? "Accepted, newer version" : "Accepted" };
  if (i.status === "withdrawn") return { tone: "neutral", text: "Withdrawn" };
  return { tone: "neutral", text: "Not given" };
};

// SCR-038 (consent part): the consent centre and its history (API-008). Every grant and withdrawal
// is its own dated record; nothing here edits an earlier one.
export function ConsentCentre() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: privacyKeys.consents, queryFn: privacyApi.myConsents });

  if (isPending) {
    return (
      <SkeletonScreen label="Loading your consents" className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </SkeletonScreen>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="We could not load your consents."
        description="Check your connection and try again. Nothing was changed."
        retry={{ label: "Try again", onClick: () => void refetch() }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <ConsentList view={data} />
      <ConsentHistory view={data} />
    </div>
  );
}

function ConsentList({ view }: { view: MyConsentView }) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: (v: { item: MyConsentItem; action: "granted" | "withdrawn" }) =>
      privacyApi.updateConsents({
        source: v.item.needsAction || v.item.outdated ? "recapture" : "consent_centre",
        changes: [{ purpose: v.item.purpose, action: v.action, policyVersion: v.item.policy.version }],
      }),
    onMutate: (v) => {
      setPending(v.item.purpose);
      setErrors((e) => ({ ...e, [v.item.purpose]: "" }));
    },
    onSuccess: (updated, v) => {
      queryClient.setQueryData(privacyKeys.consents, updated);
      toast.success(v.action === "granted" ? `Recorded: you accepted the ${v.item.label}.` : `Recorded: you withdrew "${v.item.label}".`);
    },
    onError: (err, v) => {
      setErrors((e) => ({ ...e, [v.item.purpose]: apiMessage(err, "Could not save that choice. Try again.") }));
      // A 409 means a newer version was published while this page was open.
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: privacyKeys.consents });
    },
    onSettled: () => setPending(null),
  });

  return (
    <Card id="consent">
      <CardHeader>
        <CardTitle>Your consents</CardTitle>
        <CardDescription>
          Each choice is saved with the date and the version you saw. You can withdraw an optional choice at any time; withdrawing is as easy as giving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {view.items.map((item) => {
            const c = chip(item);
            const busy = pending === item.purpose;
            const errId = `consent-err-${item.purpose}`;
            return (
              <li key={item.purpose} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium">{item.label}</h4>
                  <StatusChip tone={c.tone}>{c.text}</StatusChip>
                </div>
                <p className="text-sm text-text-secondary">{item.description}</p>
                <p className="text-sm">
                  <span className="font-medium">Version {item.policy.version}:</span> {item.policy.summary}{" "}
                  {item.policy.documentPath && (
                    <Link href={item.policy.documentPath} className="underline">
                      Read in full<span className="sr-only"> ({item.label})</span>
                    </Link>
                  )}
                </p>
                <p className="text-xs text-text-secondary">{statusText(item)}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {(item.needsAction || item.outdated || (item.status !== "granted" && item.withdrawable)) && (
                    <Button
                      size="sm"
                      variant={item.needsAction ? "default" : "secondary"}
                      loading={busy && change.variables?.action === "granted"}
                      onClick={() => change.mutate({ item, action: "granted" })}
                      aria-describedby={errors[item.purpose] ? errId : undefined}
                    >
                      {item.status === "granted" || item.needsAction ? `Accept version ${item.policy.version}` : "Give consent"}
                      <span className="sr-only"> for {item.label}</span>
                    </Button>
                  )}
                  {item.withdrawable && item.status === "granted" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy && change.variables?.action === "withdrawn"}
                      onClick={() => change.mutate({ item, action: "withdrawn" })}
                      aria-describedby={errors[item.purpose] ? errId : undefined}
                    >
                      Withdraw<span className="sr-only"> consent for {item.label}</span>
                    </Button>
                  )}
                  {!item.withdrawable && (
                    <span className="text-xs text-text-secondary">
                      Needed to hold an account. To stop, <Link href="/profile" className="underline">delete your account</Link>.
                    </span>
                  )}
                </div>
                {errors[item.purpose] && (
                  <p id={errId} role="alert" className="text-sm text-danger">
                    {errors[item.purpose]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ConsentHistory({ view }: { view: MyConsentView }) {
  return (
    <Card id="consent-history">
      <CardHeader>
        <CardTitle>Consent history</CardTitle>
        <CardDescription>Every acceptance and withdrawal, newest first. Entries are never edited.</CardDescription>
      </CardHeader>
      <CardContent>
        {view.history.length === 0 ? (
          <EmptyState
            title="No consent recorded yet"
            description="When you accept or withdraw a consent it appears here with the date."
            action={{ label: "Review your consents", href: "#consent" }}
            as="h3"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Your consent history, newest first</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-4 font-medium">When</th>
                  <th scope="col" className="py-2 pr-4 font-medium">What</th>
                  <th scope="col" className="py-2 font-medium">What happened</th>
                </tr>
              </thead>
              <tbody>
                {view.history.map((h) => (
                  <tr key={h.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <time dateTime={h.createdAt}>{formatConsentTime(h.createdAt)}</time>
                    </td>
                    <th scope="row" className="py-2 pr-4 font-normal">{h.label}</th>
                    <td className="py-2">{historyText(h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
