import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@packetpulse/types";
import { cn } from "@/shared/utils/cn";

// Live checklist under a new-password field — rules come from the same
// PASSWORD_RULES the backend's PasswordSchema is built from.
export function PasswordRequirements({ password, confirm }: { password: string; confirm?: string }) {
  const items: { id: string; label: string; met: boolean }[] = PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.pattern.test(password) }));
  if (confirm !== undefined) {
    items.push({ id: "match", label: "Both passwords match", met: password.length > 0 && password === confirm });
  }

  return (
    <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-label="Password requirements">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn("flex items-center gap-1.5", item.met ? "text-emerald-500" : "text-muted-foreground")}
        >
          {item.met ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
          <span>{item.label}</span>
          <span className="sr-only">{item.met ? "(met)" : "(not met)"}</span>
        </li>
      ))}
    </ul>
  );
}
