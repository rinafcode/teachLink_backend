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
import { ApiTags, ApiOperation, IApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { EmailMarketingService } from './email-marketing.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ScheduleCampaignDto } from './dto/schedule-campaign.dto';
import { Campaign } from './entities/campaign.entity';

@ApiTags('Email Marketing - Campaigns')
@ApiBearerAuth()
@Controller('email-marketing/campaigns')
export class EmailMarketingController {
  constructor(private readonly emailMarketingService: EmailMarketingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new email campaign' })
  @IApiResponse({ status: 201, description: 'Campaign created successfully', type: Campaign })
  @IApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    return this.emailMarketingService.createCampaign(createCampaignDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all campaigns with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @IApiResponse({ status: 200, description: 'List of campaigns' })
  async findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.emailMarketingService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  @IApiResponse({ status: 200, description: 'Campaign details', type: Campaign })
  @IApiResponse({ status: 404, description: 'Campaign not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  @IApiResponse({ status: 200, description: 'Campaign updated successfully', type: Campaign })
  @IApiResponse({ status: 400, description: 'Cannot update sent campaign' })
  @IApiResponse({ status: 404, description: 'Campaign not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    return this.emailMarketingService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign' })
  @IApiResponse({ status: 204, description: 'Campaign deleted successfully' })
  @IApiResponse({ status: 400, description: 'Cannot delete sending campaign' })
  @IApiResponse({ status: 404, description: 'Campaign not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.emailMarketingService.remove(id);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule a campaign for future sending' })
  @IApiResponse({ status: 200, description: 'Campaign scheduled successfully', type: Campaign })
  @IApiResponse({ status: 400, description: 'Invalid schedule or campaign status' })
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() scheduleDto: ScheduleCampaignDto,
  ): Promise<Campaign> {
    return this.emailMarketingService.scheduleCampaign(id, scheduleDto);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send a campaign immediately' })
  @IApiResponse({ status: 200, description: 'Campaign sending initiated', type: Campaign })
  @IApiResponse({ status: 400, description: 'Campaign cannot be sent' })
  async send(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.sendCampaign(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a scheduled or sending campaign' })
  @IApiResponse({ status: 200, description: 'Campaign paused successfully', type: Campaign })
  @IApiResponse({ status: 400, description: 'Campaign cannot be paused' })
  async pause(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.pauseCampaign(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused campaign' })
  @IApiResponse({ status: 200, description: 'Campaign resumed successfully', type: Campaign })
  @IApiResponse({ status: 400, description: 'Campaign cannot be resumed' })
  async resume(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.resumeCampaign(id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a campaign' })
  @IApiResponse({ status: 201, description: 'Campaign duplicated successfully', type: Campaign })
  @IApiResponse({ status: 404, description: 'Campaign not found' })
  async duplicate(@Param('id', ParseUUIDPipe) id: string): Promise<Campaign> {
    return this.emailMarketingService.duplicateCampaign(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get campaign statistics' })
  @IApiResponse({ status: 200, description: 'Campaign statistics' })
  @IApiResponse({ status: 404, description: 'Campaign not found' })
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailMarketingService.getCampaignStats(id);
  }
}
