import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ContentReportingService } from './content-reporting.service';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ListContentReportsQueryDto } from './dto/list-content-reports-query.dto';
import { ReviewContentReportDto } from './dto/review-content-report.dto';

@ApiTags('moderation')
@Controller('moderation/reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentReportsController {
  constructor(private readonly reportingService: ContentReportingService) {}

  @Post()
  @ApiOperation({ summary: 'Report inappropriate content' })
  @ApiResponse({ status: 201, description: 'Content reported successfully' })
  async reportContent(@Body() dto: CreateContentReportDto, @Request() req) {
    return this.reportingService.reportContent(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List reports for moderation tracking' })
  @ApiResponse({ status: 200, description: 'Returns reports visible to moderators' })
  async listReports(@Query() query: ListContentReportsQueryDto, @Request() req) {
    return this.reportingService.listReports(query, req.user);
  }

  @Get('queue')
  @ApiOperation({ summary: 'Get pending reports in the moderation queue' })
  @ApiResponse({ status: 200, description: 'Returns queued reports' })
  async getQueue(@Request() req) {
    return this.reportingService.getQueue(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single report' })
  @ApiResponse({ status: 200, description: 'Returns the report details' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReportById(@Param('id') id: string, @Request() req) {
    return this.reportingService.getReportById(id, req.user);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Resolve or dismiss a report' })
  @ApiResponse({ status: 200, description: 'Report reviewed successfully' })
  @ApiResponse({ status: 400, description: 'Report already finalized' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async reviewReport(
    @Param('id') id: string,
    @Body() dto: ReviewContentReportDto,
    @Request() req,
  ) {
    return this.reportingService.reviewReport(id, dto, req.user);
  }
}

