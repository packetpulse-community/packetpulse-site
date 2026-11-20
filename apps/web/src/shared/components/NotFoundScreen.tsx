import Link from "next/link";
import { SearchX } from "lucide-react";
import { StatusScreen } from "./StatusScreen";

// SCR-043 copy: "We could not find that page. Go to your dashboard, or search for
// what you need." The dashboard is the primary action; "search" is a quiet link
// to the resource library search.
export function NotFoundScreen({ mode }: { mode?: "page" | "embedded" }) {
  return (
    <StatusScreen
      mode={mode}
      icon={<SearchX className="h-6 w-6" />}
      title="Page not found"
      action={{ label: "Go to your dashboard", href: "/dashboard" }}
    >
      <p>
        We could not find that page. Go to your dashboard, or{" "}
        <Link href="/resources" className="underline underline-offset-4 hover:text-foreground">
          search for what you need
        </Link>
        .
      </p>
    </StatusScreen>
  );
}
