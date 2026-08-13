import { Module } from "@nestjs/common";
import { ForumsController } from "./presentation/controllers/forums.controller";
import { ForumThreadsService } from "./application/services/forum-threads.service";
import { ForumRepliesService } from "./application/services/forum-replies.service";

@Module({
  controllers: [ForumsController],
  providers: [ForumThreadsService, ForumRepliesService],
})
export class ForumsModule {}
