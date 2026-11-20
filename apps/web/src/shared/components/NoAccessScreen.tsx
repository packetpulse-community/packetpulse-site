import { ShieldAlert } from "lucide-react";
import { StatusScreen } from "./StatusScreen";

// SCR-043 "no access": says in plain words why, and gives a valid destination
// (never a blank screen, section 12). Use it where a signed-in member opens
// something their role does not allow.
export function NoAccessScreen({
  mode,
  destination = { label: "Go to your dashboard", href: "/dashboard" },
}: {
  mode?: "page" | "embedded";
  destination?: { label: string; href: string };
}) {
  return (
    <StatusScreen
      mode={mode}
      icon={<ShieldAlert className="h-6 w-6" />}
      title="You do not have access to this page"
      action={destination}
    >
      <p>Your account does not include this area. If you think it should, ask an administrator to check your role.</p>
    </StatusScreen>
  );
}
