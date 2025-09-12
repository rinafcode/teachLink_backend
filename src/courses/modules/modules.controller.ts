import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { ModulesService } from './modules.service';
import type { CreateModuleDto } from './dto/create-module.dto';
import type { UpdateModuleDto } from './dto/update-module.dto';

@Controller('courses/:courseId/modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post()
  create(
    @Body() createModuleDto: CreateModuleDto,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    createModuleDto.courseId = courseId;
    return this.modulesService.create(createModuleDto);
  }

  @Get()
  findAll(@Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.modulesService.findAll(courseId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateModuleDto: UpdateModuleDto,
  ) {
    return this.modulesService.update(id, updateModuleDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.modulesService.remove(id);
  }

  @Post('reorder')
  reorder(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() body: { moduleIds: string[] },
  ) {
    return this.modulesService.reorder(courseId, body.moduleIds);
  }
}
