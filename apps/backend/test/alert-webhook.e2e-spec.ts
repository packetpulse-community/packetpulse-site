import { Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import * as http from "http";
import { AddressInfo } from "net";
import { notifyAlertWebhook, resetAlertWebhookState } from "../src/modules/notifications/infrastructure/queue/alert-webhook";
import { handleJobFailed, handleJobStalled } from "../src/modules/notifications/infrastructure/queue/queue-alerts";

// TASK-016: the optional alert webhook. A real local HTTP server stands in for Slack.
describe("Job alert webhook", () => {
  let server: http.Server;
  let url: string;
  let received: { body: Record<string, unknown> }[];
  let mode: "ok" | "hang" | "fail";
  const logger = new Logger("test");

  const waitFor = async (cond: () => boolean, ms = 2000) => {
    const end = Date.now() + ms;
    while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
  };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        received.push({ body: JSON.parse(data) });
        if (mode === "hang") return; // never answers
        res.statusCode = mode === "fail" ? 500 : 200;
        res.end("ok");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook/SECRET-TOKEN`;
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterAll(async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    jest.restoreAllMocks();
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  });

  beforeEach(() => {
    received = [];
    mode = "ok";
    resetAlertWebhookState();
    process.env.ALERT_WEBHOOK_URL = url;
  });

  it("does nothing when ALERT_WEBHOOK_URL is unset", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    expect(notifyAlertWebhook("job_failed", { queue: "email", jobId: "1" })).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(0);
  });

  it("posts a final failure through the existing alert path with an allowlisted, redacted payload", async () => {
    const job = { id: "42", attemptsMade: 3, opts: { attempts: 3 } } as never;
    handleJobFailed(logger, "email", job, new Error("SMTP refused alice@example.com via https://mail.example.com/send?token=abc123 key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), {
      to: "alice@example.com",
      otp: "123456",
    });
    await waitFor(() => received.length > 0);
    expect(received).toHaveLength(1);
    const body = received[0].body;
    const raw = JSON.stringify(body);
    expect(body).toMatchObject({ event: "job_failed", queue: "email", jobId: "42", attempts: 3, maxAttempts: 3, permanent: false });
    expect(raw).not.toContain("alice@example.com");
    expect(raw).not.toContain("token=abc123");
    expect(raw).not.toContain("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(raw).not.toContain("123456");
    expect(raw).not.toContain("SECRET-TOKEN");
  });

  it("does not alert on a retryable failure that will be retried", async () => {
    handleJobFailed(logger, "email", { id: "1", attemptsMade: 1, opts: { attempts: 3 } } as never, new Error("temporary"));
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(0);
  });

  it("alerts on a permanent failure and on a stalled job", async () => {
    handleJobFailed(logger, "fanout", { id: "7", attemptsMade: 1, opts: { attempts: 5 } } as never, new UnrecoverableError("bad payload"));
    handleJobStalled(logger, "email", "9");
    await waitFor(() => received.length >= 2);
    const events = received.map((r) => `${r.body.event}:${r.body.queue}`).sort();
    expect(events).toEqual(["job_failed:fanout", "job_stalled:email"]);
  });

  it("sends at most one message per minute per queue and reports how many were held back", async () => {
    const t0 = 1_000_000;
    expect(notifyAlertWebhook("job_failed", { queue: "email", jobId: "1" }, t0)).toBe(true);
    for (let i = 2; i <= 50; i++) expect(notifyAlertWebhook("job_failed", { queue: "email", jobId: String(i) }, t0 + i * 100)).toBe(false);
    expect(notifyAlertWebhook("job_failed", { queue: "other", jobId: "1" }, t0 + 10)).toBe(true); // separate queue
    expect(notifyAlertWebhook("job_failed", { queue: "email", jobId: "99" }, t0 + 60_001)).toBe(true);
    await waitFor(() => received.length >= 3);
    expect(received).toHaveLength(3);
    const last = received.find((r) => r.body.jobId === "99")!;
    expect(last.body.suppressed).toBe(49);
  });

  it("times out a hanging endpoint without blocking or throwing", async () => {
    mode = "hang";
    const started = Date.now();
    expect(() => notifyAlertWebhook("job_failed", { queue: "email", jobId: "1" })).not.toThrow();
    expect(Date.now() - started).toBeLessThan(100); // fire-and-forget
    await waitFor(() => received.length > 0);
  });

  it("never throws on an error response, an unreachable host or a malformed URL", () => {
    mode = "fail";
    expect(() => notifyAlertWebhook("job_failed", { queue: "a" })).not.toThrow();
    process.env.ALERT_WEBHOOK_URL = "http://127.0.0.1:1/unreachable";
    expect(() => notifyAlertWebhook("job_failed", { queue: "b" })).not.toThrow();
    process.env.ALERT_WEBHOOK_URL = "not a url";
    expect(() => notifyAlertWebhook("job_failed", { queue: "c" })).not.toThrow();
  });
});
