import { Module } from "@nestjs/common";
import { CategoriesController } from "./presentation/controllers/categories.controller";
import { CategoriesService } from "./application/services/categories.service";

import { AdminModule } from "../admin";

@Module({
  imports: [AdminModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
