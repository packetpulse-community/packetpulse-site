import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { CaptchaService } from "../src/common/captcha";
import { parseTrustProxy } from "../src/common/config/trust-proxy";

const CAPTCHA_MESSAGE = "We could not confirm you are human. Please try again.";
const GOOD = "good-token";

// Stands in for CaptchaService so no test touches Cloudflare. Only GOOD verifies.
class FakeCaptcha {
  enabled = false;
  calls: { token: string; ip?: string }[] = [];
  isEnabled() {
    return this.enabled;
  }
  async verify(token: string, ip?: string) {
    this.calls.push({ token, ip });
    return token === GOOD;
  }
}

describe("Bot protection e2e (TASK-013 / TEST-013 / SEC-06)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fake = new FakeCaptcha();
  const email = "e2e-captcha-user@example.com";
  const password = "Passw0rd!23";
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CaptchaService)
      .useValue(fake)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  describe("disabled (no secret key)", () => {
    beforeAll(() => {
      fake.enabled = false;
      fake.calls = [];
    });

    it("ignores tokens and never calls the verifier", async () => {
      const res = await request(server()).post("/api/auth/login").send({ email: "nobody-captcha@example.com", password: "x" });
      expect(res.status).toBe(401); // the normal login failure, not a captcha rejection
      await request(server())
        .post("/api/auth/login")
        .send({ email: "nobody-captcha@example.com", password: "x", captchaToken: "garbage" })
        .expect(401);
      expect(fake.calls).toHaveLength(0);
    });
  });

  describe("enabled", () => {
    beforeAll(() => {
      fake.enabled = true;
    });

    const routes: { name: string; path: string; body: Record<string, unknown>; okStatus: number[] }[] = [
      {
        name: "register",
        path: "/api/auth/register",
        body: { firstName: "Cap", lastName: "Tcha", email, password },
        okStatus: [201],
      },
      {
        name: "login",
        path: "/api/auth/login",
        body: { email: "nobody-captcha@example.com", password: "x" },
        okStatus: [401], // good token passes the guard, then credentials fail normally
      },
      {
        name: "forgotpassword",
        path: "/api/auth/forgotpassword",
        body: { email: "nobody-captcha@example.com" },
        okStatus: [200],
      },
      {
        name: "verifyotp",
        path: "/api/auth/verifyotp",
        body: { email: "nobody-captcha@example.com", otp: "000000" },
        okStatus: [400, 401, 404, 422], // passes the guard; the OTP itself is wrong
      },
    ];

    for (const r of routes) {
      describe(r.name, () => {
        it("rejects a missing token with 400 and the plain message", async () => {
          const res = await request(server()).post(r.path).send(r.body).expect(400);
          expect(res.body.message).toBe(CAPTCHA_MESSAGE);
          expect(res.body.code).toBe("BAD_REQUEST");
        });

        it("rejects a bad token with 400", async () => {
          const res = await request(server()).post(r.path).send({ ...r.body, captchaToken: "bad" }).expect(400);
          expect(res.body.message).toBe(CAPTCHA_MESSAGE);
        });

        it("accepts a good token", async () => {
          const res = await request(server()).post(r.path).send({ ...r.body, captchaToken: GOOD });
          expect(r.okStatus).toContain(res.status);
          expect(res.body.message).not.toBe(CAPTCHA_MESSAGE);
        });
      });
    }

    it("does not protect refresh or resetpassword", async () => {
      const refresh = await request(server()).post("/api/auth/refresh");
      expect(refresh.body.message).not.toBe(CAPTCHA_MESSAGE);
      const reset = await request(server())
        .post("/api/auth/resetpassword")
        .send({ tempToken: "nope", password });
      expect(reset.body.message).not.toBe(CAPTCHA_MESSAGE);
    });
  });
});

describe("CaptchaService (real verifier, fetch mocked)", () => {
  const realFetch = global.fetch;
  const make = (secret?: string) =>
    new CaptchaService({ get: (k: string) => (k === "TURNSTILE_SECRET_KEY" ? secret : undefined) } as unknown as ConfigService);
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("is disabled without a secret (blank counts as unset) and never calls fetch", async () => {
    global.fetch = jest.fn() as never;
    expect(make(undefined).isEnabled()).toBe(false);
    expect(make("  ").isEnabled()).toBe(false);
    expect(await make().verify("t")).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends secret, token and visitor ip, and accepts success:true", async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    global.fetch = f as never;
    expect(await make("sekret").verify("tok", "203.0.113.9")).toBe(true);
    const body = (f.mock.calls[0][1].body as URLSearchParams).toString();
    expect(body).toContain("secret=sekret");
    expect(body).toContain("response=tok");
    expect(body).toContain("remoteip=203.0.113.9");
  });

  it("rejects success:false", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }) }) as never;
    expect(await make("sekret").verify("tok")).toBe(false);
  });

  it("fails closed when Turnstile is unreachable or errors", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as never;
    expect(await make("sekret").verify("tok")).toBe(false);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as never;
    expect(await make("sekret").verify("tok")).toBe(false);
  });
});

describe("parseTrustProxy (S-11)", () => {
  it("defaults to true when unset or blank", () => {
    expect(parseTrustProxy(undefined)).toBe(true);
    expect(parseTrustProxy("")).toBe(true);
    expect(parseTrustProxy("  ")).toBe(true);
  });
  it("accepts true / false in any case", () => {
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("FALSE")).toBe(false);
  });
  it("accepts hop counts", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("0")).toBe(0);
  });
  it("accepts address and CIDR lists and Express keywords", () => {
    expect(parseTrustProxy("10.0.0.0/8, 172.16.0.1")).toEqual(["10.0.0.0/8", "172.16.0.1"]);
    expect(parseTrustProxy("2001:db8::/32")).toEqual(["2001:db8::/32"]);
    expect(parseTrustProxy("loopback,uniquelocal")).toEqual(["loopback", "uniquelocal"]);
  });
  it("rejects anything else", () => {
    for (const bad of ["-1", "1.5", "yes", "10.0.0.0/33", "2001:db8::/129", "10.0.0.1,", "10.0.0.1/", "999.1.1.1", "1 2", "10.0.0.1/8/8"]) {
      expect(() => parseTrustProxy(bad)).toThrow(/TRUST_PROXY/);
    }
  });
});
