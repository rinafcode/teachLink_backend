import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SegmentService } from './segment.service';
import { SegmentDestinationConfig } from './segment-destination-config.entity';
import {
  TrackEventDto,
  IdentifyUserDto,
  CreateDestinationConfigDto,
  UpdateDestinationConfigDto,
} from './segment.dto';

@ApiTags('Segment Analytics')
@Controller('analytics/segment')
export class SegmentController {
  constructor(
    private readonly segment: SegmentService,
    @InjectRepository(SegmentDestinationConfig)
    private readonly destRepo: Repository<SegmentDestinationConfig>,
  ) {}

  // ── Event tracking ──────────────────────────────────────────────────────────

  @Post('track')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track an analytics event' })
  @ApiResponse({ status: 204, description: 'Event queued' })
  track(@Body() dto: TrackEventDto): void {
    this.segment.track(dto);
  }

  @Post('identify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Identify a user' })
  @ApiResponse({ status: 204, description: 'Identify queued' })
  identify(@Body() dto: IdentifyUserDto): void {
    this.segment.identify(dto);
  }

  // ── Destination configuration CRUD ──────────────────────────────────────────

  @Post('destinations')
  @ApiOperation({ summary: 'Create a destination configuration' })
  @ApiResponse({ status: 201, type: SegmentDestinationConfig })
  createDestination(@Body() dto: CreateDestinationConfigDto): Promise<SegmentDestinationConfig> {
    const dest = this.destRepo.create({
      name: dto.name,
      enabled: dto.enabled ?? true,
      settings: dto.settings ?? {},
    });
    return this.destRepo.save(dest);
  }

  @Get('destinations')
  @ApiOperation({ summary: 'List all destination configurations' })
  @ApiResponse({ status: 200, type: [SegmentDestinationConfig] })
  listDestinations(): Promise<SegmentDestinationConfig[]> {
    return this.destRepo.find();
  }

  @Get('destinations/:id')
  @ApiOperation({ summary: 'Get a destination configuration' })
  @ApiResponse({ status: 200, type: SegmentDestinationConfig })
  getDestination(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SegmentDestinationConfig | null> {
    return this.destRepo.findOneBy({ id });
  }

  @Patch('destinations/:id')
  @ApiOperation({ summary: 'Update a destination configuration' })
  @ApiResponse({ status: 200, type: SegmentDestinationConfig })
  async updateDestination(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDestinationConfigDto,
  ): Promise<SegmentDestinationConfig> {
    await this.destRepo.update(id, dto);
    return this.destRepo.findOneByOrFail({ id });
  }

  @Delete('destinations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a destination configuration' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async deleteDestination(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.destRepo.delete(id);
  }
}
