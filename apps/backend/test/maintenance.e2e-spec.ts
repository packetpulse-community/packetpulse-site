import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SiteStatusService } from "../src/common/site-status/site-status.service";

describe("Maintenance mode & members-only resources e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let siteStatus: SiteStatusService;

  const adminEmail = "e2e-maint-admin@example.com";
  const memberEmail = "e2e-maint-member@example.com";
  const password = "Passw0rd!23";

  async function setMaintenance(on: boolean) {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: { maintenanceMode: on },
      create: { id: "default", maintenanceMode: on },
    });
    siteStatus.invalidate();
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    siteStatus = app.get(SiteStatusService);

    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await request(app.getHttpServer())
      .post("/api/auth/register-admin")
      .send({ firstName: "Maint", lastName: "Admin", email: adminEmail, password, adminSecureCode: process.env.ADMIN_SECURE_CODE })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "Maint", lastName: "Member", email: memberEmail, password })
      .expect(201);
    await prisma.user.update({ where: { email: memberEmail }, data: { isApproved: true, emailVerified: true } });
  });

  afterAll(async () => {
    await setMaintenance(false);
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await app.close();
  });

  it("serves resources to approved members only", async () => {
    await request(app.getHttpServer()).get("/api/resources").expect(401);
    const member = request.agent(app.getHttpServer());
    await member.post("/api/auth/login").send({ email: memberEmail, password }).expect(200);
    await member.get("/api/resources").expect(200);
    // Blogs stay public.
    await request(app.getHttpServer()).get("/api/blogs").expect(200);
  });

  it("blocks members and visitors but not admins while maintenance is on", async () => {
    const member = request.agent(app.getHttpServer());
    await member.post("/api/auth/login").send({ email: memberEmail, password }).expect(200);
    const admin = request.agent(app.getHttpServer());
    await admin.post("/api/auth/login").send({ email: adminEmail, password }).expect(200);

    await setMaintenance(true);

    const visitor = await request(app.getHttpServer()).get("/api/blogs").expect(503);
    expect(visitor.body.maintenance).toBe(true);
    // Existing member session is cut off too.
    const blocked = await member.get("/api/auth/me").expect(503);
    expect(blocked.body.maintenance).toBe(true);
    // New member sign-ins are refused.
    const login = await request(app.getHttpServer()).post("/api/auth/login").send({ email: memberEmail, password }).expect(503);
    expect(login.body.maintenance).toBe(true);

    // Admins keep full access and can still sign in fresh.
    await admin.get("/api/auth/me").expect(200);
    await admin.get("/api/resources").expect(200);
    await request(app.getHttpServer()).post("/api/auth/login").send({ email: adminEmail, password }).expect(200);

    // Health + site-status stay reachable for everyone.
    await request(app.getHttpServer()).get("/api/health").expect(200);
    const status = await request(app.getHttpServer()).get("/api/site-status").expect(200);
    expect(status.body).toMatchObject({ maintenanceMode: true, canBypass: false });
    const adminStatus = await admin.get("/api/site-status").expect(200);
    expect(adminStatus.body.canBypass).toBe(true);

    await setMaintenance(false);
    await member.get("/api/auth/me").expect(200);
  });
});
