import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CategoriesService } from "../../application/services/categories.service";
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from "../../application/dto/categories.dto";
import { Public, RequirePermission, PERMISSIONS } from "../../../identity";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // Public — every content list/filter/create-form dropdown needs this.
  @Public()
  @Get()
  list() {
    return this.categories.list();
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.CATEGORIES_MANAGE)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.CATEGORIES_MANAGE)
  @Put("reorder")
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.categories.reorder(dto);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.CATEGORIES_MANAGE)
  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.CATEGORIES_MANAGE)
  @Delete(":id")
  @HttpCode(200)
  async delete(@Param("id") id: string) {
    await this.categories.delete(id);
    return { success: true };
  }
}
