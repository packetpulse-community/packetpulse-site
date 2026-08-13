import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RealtimeGateway } from "./presentation/gateways/realtime.gateway";
import { PresenceService } from "./application/services/presence.service";
import { PresenceController } from "./presentation/controllers/presence.controller";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>("JWT_ACCESS_SECRET") }),
    }),
  ],
  controllers: [PresenceController],
  providers: [RealtimeGateway, PresenceService],
  exports: [PresenceService],
})
export class RealtimeModule {}
