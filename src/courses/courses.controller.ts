import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common"
import type { CoursesService } from "./courses.service"
import type { CreateCourseDto } from "./dto/create-course.dto"
import type { UpdateCourseDto } from "./dto/update-course.dto"
import type { QueryCourseDto } from "./dto/query-course.dto"

@Controller("courses")
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @Get()
  findAll(@Query() queryParams: QueryCourseDto) {
    return this.coursesService.findAll(queryParams);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(":id")
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  @Get(':id/analytics')
  getAnalytics(@Param('id') id: string) {
    return this.coursesService.getAnalytics(id);
  }
}
