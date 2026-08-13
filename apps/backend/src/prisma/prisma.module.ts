import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

// @Global so every feature module gets PrismaService without re-importing this
// module everywhere — the one deliberate cross-module shared dependency (see plan §3).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
