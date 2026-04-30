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

import { EmailMarketingService } from './email-marketing.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ScheduleCampaignDto } from './dto/schedule-campaign.dto';
import { Campaign } from './entities/campaign.entity';

/**
 * Exposes email Marketing endpoints.
 */
@ApiTags('Email Marketing - Campaigns')
@ApiBearerAuth()
@Controller('email-marketing/campaigns')
export class EmailMarketingController {
  constructor(private readonly emailMarketingService: EmailMarketingService) {}

  /**
   * Creates a new record.
   * @param createCampaignDto The request payload.
   * @returns The resulting campaign.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new email campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully', type: Campaign })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    return this.emailMarketingService.createCampaign(createCampaignDto);
  }

  /**
   * Returns all.
   * @param page The page number.
   * @param limit The maximum number of results.
   * @returns The operation result.
   */
  @Get()
  @ApiOperation({ summary: 'Get all campaigns with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'List of campaigns' })
  async findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.emailMarketingService.findAll(page, limit);
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The resulting campaign.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  @ApiResponse({ status: 200, description: 'Campaign details', type: Campaign })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.findOne(id);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateCampaignDto The request payload.
   * @returns The resulting campaign.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiResponse({ status: 200, description: 'Campaign updated successfully', type: Campaign })
  @ApiResponse({ status: 400, description: 'Cannot update sent campaign' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    return this.emailMarketingService.update(id, updateCampaignDto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiResponse({ status: 204, description: 'Campaign deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete sending campaign' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.emailMarketingService.remove(id);
  }

  /**
   * Schedules schedule.
   * @param id The identifier.
   * @param scheduleDto The request payload.
   * @returns The resulting campaign.
   */
  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule a campaign for future sending' })
  @ApiResponse({ status: 200, description: 'Campaign scheduled successfully', type: Campaign })
  @ApiResponse({ status: 400, description: 'Invalid schedule or campaign status' })
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() scheduleDto: ScheduleCampaignDto,
  ): Promise<Campaign> {
    return this.emailMarketingService.scheduleCampaign(id, scheduleDto);
  }

  /**
   * Sends send.
   * @param id The identifier.
   * @returns The resulting campaign.
   */
  @Post(':id/send')
  @ApiOperation({ summary: 'Send a campaign immediately' })
  @ApiResponse({ status: 200, description: 'Campaign sending initiated', type: Campaign })
  @ApiResponse({ status: 400, description: 'Campaign cannot be sent' })
  async send(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.sendCampaign(id);
  }

  /**
   * Pauses pause.
   * @param id The identifier.
   * @returns The resulting campaign.
   */
  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a scheduled or sending campaign' })
  @ApiResponse({ status: 200, description: 'Campaign paused successfully', type: Campaign })
  @ApiResponse({ status: 400, description: 'Campaign cannot be paused' })
  async pause(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.pauseCampaign(id);
  }

  /**
   * Resumes resume.
   * @param id The identifier.
   * @returns The resulting campaign.
   */
  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused campaign' })
  @ApiResponse({ status: 200, description: 'Campaign resumed successfully', type: Campaign })
  @ApiResponse({ status: 400, description: 'Campaign cannot be resumed' })
  async resume(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.resumeCampaign(id);
  }

  /**
   * Executes duplicate.
   * @param id The identifier.
   * @returns The resulting campaign.
   */
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a campaign' })
  @ApiResponse({ status: 201, description: 'Campaign duplicated successfully', type: Campaign })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async duplicate(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.duplicateCampaign(id);
  }

  /**
   * Returns stats.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get campaign statistics' })
  @ApiResponse({ status: 200, description: 'Campaign statistics' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailMarketingService.getCampaignStats(id);
  }
}
