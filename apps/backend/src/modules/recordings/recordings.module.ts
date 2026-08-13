import { Module } from "@nestjs/common";
import { RecordingsController } from "./presentation/controllers/recordings.controller";
import { RecordingsService } from "./application/services/recordings.service";

@Module({
  controllers: [RecordingsController],
  providers: [RecordingsService],
})
export class RecordingsModule {}
