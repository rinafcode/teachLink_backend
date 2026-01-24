import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { EmailAnalyticsService } from './email-analytics.service';

@ApiTags('Email Marketing - Analytics')
@ApiBearerAuth()
@Controller('email-marketing/analytics')
export class EmailAnalyticsController {
    constructor(private readonly analyticsService: EmailAnalyticsService) { }

    @Get('campaigns/:id')
    @ApiOperation({ summary: 'Get campaign performance metrics' })
    @ApiResponse({ status: 200, description: 'Campaign metrics' })
    @ApiResponse({ status: 404, description: 'Campaign not found' })
    async getCampaignMetrics(@Param('id', ParseUUIDPipe) id: string) {
        return this.analyticsService.getCampaignMetrics(id);
    }

    @Get('campaigns/:id/timeline')
    @ApiOperation({ summary: 'Get campaign time series data' })
    @ApiQuery({ name: 'startDate', required: true, type: String })
    @ApiQuery({ name: 'endDate', required: true, type: String })
    async getCampaignTimeline(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.analyticsService.getCampaignTimeSeries(
            id,
            new Date(startDate),
            new Date(endDate),
        );
    }

    @Get('campaigns/:id/links')
    @ApiOperation({ summary: 'Get link click analytics for a campaign' })
    async getLinkAnalytics(@Param('id', ParseUUIDPipe) id: string) {
        return this.analyticsService.getLinkAnalytics(id);
    }

    @Get('overview')
    @ApiOperation({ summary: 'Get overall email marketing statistics' })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    async getOverallStats(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.analyticsService.getOverallStats(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }
}
