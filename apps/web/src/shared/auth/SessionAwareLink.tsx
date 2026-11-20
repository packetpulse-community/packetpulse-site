"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSessionHint } from "./session-hint";
import { resolveSessionAction, type SessionAwareActions } from "./session-aware";

interface SessionAwareLinkProps extends SessionAwareActions {
  className?: string;
  // Size of the same-size placeholder shown on the server and during hydration, so the page
  // neither flashes the wrong label nor jumps when the real one appears.
  placeholderClassName?: string;
  // Icon shown after the label, for either state.
  trailingIcon?: ReactNode;
  // Render inside an <li> (footer lists) so a hidden link leaves no empty bullet.
  asListItem?: boolean;
}

// Usable from server components: the prerendered HTML contains only the placeholder.
export function SessionAwareLink({
  signedOut,
  signedIn,
  className,
  placeholderClassName,
  trailingIcon,
  asListItem,
}: SessionAwareLinkProps) {
  const hint = useSessionHint();
  const resolved = resolveSessionAction(hint, { signedOut, signedIn });
  const wrap = (node: ReactNode) => (asListItem ? <li>{node}</li> : node);

  if (resolved.kind === "hidden") return null;
  if (resolved.kind === "placeholder") {
    return wrap(<span aria-hidden="true" className={`block ${placeholderClassName ?? ""}`} />);
  }
  return wrap(
    <Link href={resolved.href} className={className}>
      {resolved.label}
      {trailingIcon}
    </Link>,
  );
}
