import { Controller, Get, Param, Post, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get course version history' })
  @ApiResponse({ status: 200, description: 'Version history returned' })
  async getVersionHistory(@Param('id') id: string) {
    return this.coursesService.getVersionHistory(id);
  }

  @Get(':id/versions/:versionNumber/diff')
  @ApiOperation({ summary: 'Get a diff between a saved course version and the current course' })
  @ApiParam({ name: 'versionNumber', type: Number })
  @ApiResponse({ status: 200, description: 'Diff returned' })
  async getVersionDiff(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: number,
  ) {
    return this.coursesService.getVersionDiff(id, Number(versionNumber));
  }

  @Post(':id/versions/:versionNumber/rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback a course to a previous version' })
  @ApiParam({ name: 'versionNumber', type: Number })
  @ApiResponse({ status: 200, description: 'Course rolled back successfully' })
  async rollbackVersion(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: number,
  ) {
    return this.coursesService.rollbackToVersion(id, Number(versionNumber));
  }
}
