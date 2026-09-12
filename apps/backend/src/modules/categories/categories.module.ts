import { Module } from "@nestjs/common";
import { CategoriesController } from "./presentation/controllers/categories.controller";
import { CategoriesService } from "./application/services/categories.service";

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
