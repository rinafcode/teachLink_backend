import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { SegmentationService } from './segmentation.service';
import { CreateSegmentDto } from '../dto/create-segment.dto';
import { UpdateSegmentDto } from '../dto/update-segment.dto';
import { AddSegmentMembersDto } from '../dto/add-segment-members.dto';
import { Segment } from '../entities/segment.entity';

/**
 * Exposes segment endpoints.
 */
@ApiTags('Email Marketing - Segments')
@ApiBearerAuth()
@Controller('email-marketing/segments')
export class SegmentController {
  constructor(private readonly segmentationService: SegmentationService) {}

  /**
   * Creates a new record.
   * @param createSegmentDto The request payload.
   * @returns The resulting segment.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new audience segment' })
  @ApiResponse({ status: 201, description: 'Segment created successfully' })
  async create(@Body() createSegmentDto: CreateSegmentDto): Promise<Segment> {
    return this.segmentationService.create(createSegmentDto);
  }

  /**
   * Returns all.
   * @param page The page number.
   * @param limit The maximum number of results.
   * @returns The operation result.
   */
  @Get()
  @ApiOperation({ summary: 'Get all segments with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.segmentationService.findAll(page, limit);
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The resulting segment.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a segment by ID' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Segment> {
    return this.segmentationService.findOne(id);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateSegmentDto The request payload.
   * @returns The resulting segment.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a segment' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSegmentDto: UpdateSegmentDto,
  ): Promise<Segment> {
    return this.segmentationService.update(id, updateSegmentDto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a segment' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.segmentationService.remove(id);
  }

  /**
   * Returns members.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'Get members of a segment' })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.segmentationService.getSegmentMembers(id);
  }

  /**
   * Executes add Members.
   * @param id The identifier.
   * @param addMembersDto The request payload.
   * @returns The operation result.
   */
  @Post(':id/members')
  @ApiOperation({ summary: 'Add users to a static segment' })
  @ApiResponse({ status: 200, description: 'Users added successfully' })
  async addMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addMembersDto: AddSegmentMembersDto,
  ): Promise<{ message: string; addedCount: number }> {
    await this.segmentationService.addUsersToSegment(id, addMembersDto.userIds);
    return {
      message: 'Users added successfully',
      addedCount: addMembersDto.userIds.length,
    };
  }

  /**
   * Executes preview.
   * @param createSegmentDto The request payload.
   * @returns The operation result.
   */
  @Post('preview')
  @ApiOperation({ summary: 'Preview segment members without saving' })
  async preview(@Body() createSegmentDto: CreateSegmentDto) {
    return this.segmentationService.previewSegment(createSegmentDto.rules);
  }
}
