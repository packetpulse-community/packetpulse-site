"use client";

import { useState } from "react";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Card } from "@/shared/ui/primitives/Card";
import { cn } from "@/shared/utils/cn";

interface EndpointEntry {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  auth: "public" | "authenticated" | "admin";
}

const ENDPOINTS: EndpointEntry[] = [
  { method: "GET", path: "/auth/me", description: "Get the current session user", auth: "authenticated" },
  { method: "POST", path: "/auth/login", description: "Log in with email/password", auth: "public" },
  { method: "GET", path: "/blogs", description: "List blog posts (search/category/tag/page)", auth: "public" },
  { method: "GET", path: "/blogs/featured", description: "List featured blog posts", auth: "public" },
  { method: "GET", path: "/blogs/slug/example-post", description: "Get a blog post by slug", auth: "public" },
  { method: "GET", path: "/resources", description: "List resources (search/type/category/page)", auth: "public" },
  { method: "PUT", path: "/resources/:id/download", description: "Increment a resource's download count", auth: "authenticated" },
  { method: "GET", path: "/recordings", description: "List recordings (search/category/page)", auth: "public" },
  { method: "GET", path: "/forums/threads", description: "List forum threads", auth: "public" },
  { method: "GET", path: "/quizzes", description: "List published quizzes", auth: "public" },
  { method: "GET", path: "/quizzes/certificates/verify/:certificateNumber", description: "Publicly verify a certificate", auth: "public" },
  { method: "GET", path: "/dashboard/stats", description: "Real content counts + simulated network figures", auth: "authenticated" },
  { method: "POST", path: "/network-tools/run", description: "Run a simulated network diagnostic tool", auth: "authenticated" },
  { method: "GET", path: "/admin/users", description: "List all users (admin)", auth: "admin" },
  { method: "GET", path: "/admin/status", description: "Real server/database diagnostics", auth: "admin" },
  { method: "GET", path: "/admin/settings", description: "Get site settings", auth: "admin" },
  { method: "GET", path: "/logs", description: "List client-side error/event logs", auth: "admin" },
];

const METHOD_COLOR: Record<EndpointEntry["method"], string> = {
  GET: "text-green-400",
  POST: "text-blue-400",
  PUT: "text-yellow-400",
  DELETE: "text-red-400",
};

export function ApiDocsExplorer() {
  const [method, setMethod] = useState<EndpointEntry["method"]>("GET");
  const [path, setPath] = useState("/dashboard/stats");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectEndpoint(entry: EndpointEntry) {
    setMethod(entry.method);
    setPath(entry.path);
    setBody("");
    setResponse(null);
    setError(null);
  }

  async function sendRequest() {
    setSending(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(`/api${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: method === "GET" || method === "DELETE" ? undefined : body || undefined,
      });
      const text = await res.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // not JSON, show as-is
      }
      setResponse({ status: res.status, body: formatted });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card variant="glass" className="flex flex-col gap-1 p-3">
        <h2 className="mb-1 px-1 text-sm font-semibold text-muted-foreground">Endpoints</h2>
        {ENDPOINTS.map((entry) => (
          <button
            key={`${entry.method}-${entry.path}`}
            onClick={() => selectEndpoint(entry)}
            className="glass-interactive flex flex-col gap-0.5 rounded-md p-2 text-left"
          >
            <span className="flex items-center gap-2 text-xs">
              <span className={cn("font-mono font-semibold", METHOD_COLOR[entry.method])}>{entry.method}</span>
              <span className="font-mono">{entry.path}</span>
            </span>
            <span className="text-xs text-muted-foreground">{entry.description}</span>
            <Badge variant="glass" className="w-fit text-[10px]">
              {entry.auth}
            </Badge>
          </button>
        ))}
      </Card>

      <div className="flex flex-col gap-4">
        <Card variant="glass" className="flex flex-col gap-3 p-4">
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as EndpointEntry["method"])}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/blogs"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
            <Button variant="gradient" onClick={sendRequest} disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
          {method !== "GET" && method !== "DELETE" && (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Request body (JSON)"
              rows={4}
              className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Requests are sent with your current session cookies — this hits the real API, not a mock.
          </p>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {response && (
          <Card variant="glass" className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Response</span>
              <Badge variant={response.status < 400 ? "success" : "danger"}>{response.status}</Badge>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md bg-background p-3 text-xs">{response.body}</pre>
          </Card>
        )}
      </div>
    </div>
  );
}
