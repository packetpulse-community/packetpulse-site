import * as net from "node:net";
import type { AddressInfo } from "node:net";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import { MailDeliveryError, MailerService } from "../src/modules/notifications/infrastructure/email/mailer.service";

// Mailer regression tests (TASK-011, nodemailer 6 -> 10). Nothing here reaches a real
// mail server: the SMTP path talks to an in-process sink on 127.0.0.1, the Resend path
// uses a mocked global fetch, and the transport options are asserted via a spy.

function config(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

interface Received {
  auth?: string;
  mailFrom?: string;
  rcptTo: string[];
  data: string;
}

// Minimal SMTP server: EHLO (advertising AUTH PLAIN), AUTH PLAIN, MAIL, RCPT, DATA, QUIT.
// `rejectRcpt` makes RCPT answer 550 (and drops AUTH, as nodemailer 6 and 10 both fail
// with EAUTH when AUTH is offered but no credentials are configured).
function startSink(opts: { rejectRcpt?: boolean } = {}) {
  const received: Received[] = [];
  const server = net.createServer((socket) => {
    let current: Received = { rcptTo: [], data: "" };
    let inData = false;
    let buffer = "";
    socket.write("220 sink ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            received.push(current);
            current = { rcptTo: [], data: "" };
            socket.write("250 queued\r\n");
          } else {
            current.data += `${line}\n`;
          }
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) {
          socket.write(opts.rejectRcpt ? "250 sink\r\n" : "250-sink\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (cmd.startsWith("AUTH PLAIN")) {
          current.auth = Buffer.from(line.split(" ")[2] ?? "", "base64").toString("utf8");
          socket.write("235 ok\r\n");
        } else if (cmd.startsWith("MAIL FROM")) {
          current.mailFrom = line;
          socket.write("250 ok\r\n");
        } else if (cmd.startsWith("RCPT TO")) {
          if (opts.rejectRcpt) socket.write("550 no such mailbox\r\n");
          else {
            current.rcptTo.push(line);
            socket.write("250 ok\r\n");
          }
        } else if (cmd === "DATA") {
          inData = true;
          socket.write("354 go\r\n");
        } else if (cmd === "QUIT") {
          socket.end("221 bye\r\n");
        } else {
          socket.write("250 ok\r\n");
        }
      }
    });
    socket.on("error", () => undefined);
  });
  return new Promise<{ port: number; received: Received[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: (server.address() as AddressInfo).port,
        received,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe("MailerService (nodemailer)", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  describe("SMTP branch", () => {
    it("builds the transport with host, port, secure=port===465, connectionTimeout and auth", () => {
      const spy = jest.spyOn(nodemailer, "createTransport");
      new MailerService(config({ SMTP_HOST: "smtp.example.test", SMTP_PORT: 587, SMTP_USER: "u", SMTP_PASSWORD: "p" }));
      new MailerService(config({ SMTP_HOST: "smtp.example.test", SMTP_PORT: 465, SMTP_USER: "u", SMTP_PASSWORD: "p" }));
      new MailerService(config({ SMTP_HOST: "smtp.example.test" })); // default port
      const opts = spy.mock.calls.map((c) => c[0] as Record<string, unknown>);
      expect(opts[0]).toEqual({
        host: "smtp.example.test",
        port: 587,
        secure: false,
        connectionTimeout: 15_000,
        auth: { user: "u", pass: "p" },
      });
      expect(opts[1]).toMatchObject({ port: 465, secure: true });
      expect(opts[2]).toMatchObject({ port: 587, secure: false });
    });

    it("sends a real SMTP conversation (auth, from, to, subject, text) to a local sink", async () => {
      const sink = await startSink();
      try {
        const mailer = new MailerService(
          config({ SMTP_HOST: "127.0.0.1", SMTP_PORT: sink.port, SMTP_USER: "mailuser", SMTP_PASSWORD: "mailpass" }),
        );
        await mailer.send("alice@example.test", "Your code", "Code: 123456");
        expect(sink.received).toHaveLength(1);
        const msg = sink.received[0];
        expect(msg.auth).toBe("\0mailuser\0mailpass");
        expect(msg.mailFrom).toContain("no-reply@packetpulse.in");
        expect(msg.rcptTo[0]).toContain("alice@example.test");
        expect(msg.data).toContain("Subject: Your code");
        expect(msg.data).toContain("From: PacketPulse <no-reply@packetpulse.in>");
        expect(msg.data).toContain("Code: 123456");
      } finally {
        await sink.close();
      }
    });

    it("maps a 5xx SMTP rejection to a permanent MailDeliveryError", async () => {
      const sink = await startSink({ rejectRcpt: true });
      try {
        const mailer = new MailerService(config({ SMTP_HOST: "127.0.0.1", SMTP_PORT: sink.port }));
        const err = await mailer.send("nobody@example.test", "s", "t").catch((e) => e);
        expect(err).toBeInstanceOf(MailDeliveryError);
        expect((err as MailDeliveryError).message).toContain("550");
        expect((err as MailDeliveryError).permanent).toBe(true);
      } finally {
        await sink.close();
      }
    });

    it("treats a connection failure as retryable (not permanent)", async () => {
      const sink = await startSink();
      const port = sink.port;
      await sink.close(); // nothing listens on this port any more
      const mailer = new MailerService(config({ SMTP_HOST: "127.0.0.1", SMTP_PORT: port }));
      const err = await mailer.send("a@example.test", "s", "t").catch((e) => e);
      expect(err).toBeInstanceOf(MailDeliveryError);
      expect((err as MailDeliveryError).permanent).toBe(false);
    });
  });

  describe("transport selection", () => {
    it("prefers the Resend API over SMTP when RESEND_API_KEY is set, and never builds an SMTP transport", async () => {
      const create = jest.spyOn(nodemailer, "createTransport");
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;
      const mailer = new MailerService(config({ RESEND_API_KEY: "re_test", SMTP_HOST: "smtp.example.test" }));
      await mailer.send("bob@example.test", "Hello", "Body");
      expect(create).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect(init.headers.Authorization).toBe("Bearer re_test");
      expect(JSON.parse(init.body)).toEqual({
        from: "PacketPulse <no-reply@packetpulse.in>",
        to: ["bob@example.test"],
        subject: "Hello",
        text: "Body",
      });
    });

    it("marks Resend 4xx (except 408/429) permanent and 5xx/429 retryable", async () => {
      const mailer = new MailerService(config({ RESEND_API_KEY: "re_test" }));
      const reply = (status: number) => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status,
          statusText: "x",
          json: async () => ({ name: "validation_error", message: "bad" }),
        }) as unknown as typeof fetch;
      };
      reply(422);
      expect(await mailer.send("a@example.test", "s", "t").catch((e) => e.permanent)).toBe(true);
      reply(429);
      expect(await mailer.send("a@example.test", "s", "t").catch((e) => e.permanent)).toBe(false);
      reply(503);
      expect(await mailer.send("a@example.test", "s", "t").catch((e) => e.permanent)).toBe(false);
    });

    it("with neither configured: logs in dev, throws in production, builds no transport", async () => {
      const create = jest.spyOn(nodemailer, "createTransport");
      global.fetch = jest.fn() as unknown as typeof fetch;
      await expect(new MailerService(config({ NODE_ENV: "test" })).send("a@example.test", "s", "t")).resolves.toBeUndefined();
      await expect(new MailerService(config({ NODE_ENV: "production" })).send("a@example.test", "s", "t")).rejects.toThrow(
        /not configured/,
      );
      expect(create).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
