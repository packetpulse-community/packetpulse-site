"use client";

import Link from "next/link";
import { CONSENT_PURPOSE_META, type ConsentPolicyView, type ConsentPurpose } from "@packetpulse/types";
import type { RegistrationTicks } from "../lib/consent-logic";

interface Props {
  policies: readonly ConsentPolicyView[];
  ticks: RegistrationTicks;
  onToggle: (purpose: ConsentPurpose, checked: boolean) => void;
  /** Inline error for the required group. */
  error?: string;
  errorId: string;
}

// The consent step of registration (TASK-025, PRD-010). Each tick names the policy and its version;
// that version is what the form sends. Required consents are the Terms and the Privacy Policy;
// the rest are optional, off by default and can be changed later in the consent centre.
export function RegistrationConsents({ policies, ticks, onToggle, error, errorId }: Props) {
  const required = policies.filter((p) => p.required);
  const optional = policies.filter((p) => !p.required);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3" aria-describedby={error ? errorId : undefined}>
        <legend className="text-sm font-medium">Before you join</legend>
        {required.map((p) => {
          const id = `consent-${p.purpose}`;
          const doc = CONSENT_PURPOSE_META[p.purpose].documentPath;
          return (
            <div key={p.purpose} className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                id={id}
                type="checkbox"
                checked={!!ticks[p.purpose]}
                onChange={(e) => onToggle(p.purpose, e.target.checked)}
                aria-required="true"
                aria-invalid={error && !ticks[p.purpose] ? true : undefined}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
              />
              <label htmlFor={id} className="flex flex-col gap-0.5">
                <span>
                  I accept the{" "}
                  <span className="font-medium text-foreground">{p.title}</span>
                  <span className="text-xs"> (version {p.version})</span>
                </span>
                <span className="text-xs">{p.summary}</span>
              </label>
              {doc && (
                <Link href={doc} target="_blank" rel="noopener" className="ml-auto shrink-0 text-xs font-medium text-foreground underline">
                  Read in full<span className="sr-only"> ({p.title}, opens in a new tab)</span>
                </Link>
              )}
            </div>
          );
        })}
        {error && (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </fieldset>

      {optional.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Optional choices</legend>
          <p className="text-xs text-muted-foreground">Off unless you tick them. You can change any of these later under Privacy and consent.</p>
          {optional.map((p) => {
            const id = `consent-${p.purpose}`;
            return (
              <div key={p.purpose} className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  id={id}
                  type="checkbox"
                  checked={!!ticks[p.purpose]}
                  onChange={(e) => onToggle(p.purpose, e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                />
                <label htmlFor={id} className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{p.label}</span>
                  <span className="text-xs">{p.summary}</span>
                </label>
              </div>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
