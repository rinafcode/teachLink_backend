import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService, ExportFormat } from '../export/export.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  /**
   * Request user data export
   */
  @Post('user-data')
  async requestUserDataExport(
    @CurrentUser() user: any,
    @Query('format') format: ExportFormat = 'json',
  ) {
    const validFormats: ExportFormat[] = ['json', 'pdf', 'csv'];
    if (!validFormats.includes(format)) {
      throw new BadRequestException(
        `Invalid format. Supported formats: ${validFormats.join(', ')}`,
      );
    }

    this.logger.log(`User ${user.id} requested data export in ${format} format`);
    return this.exportService.requestUserDataExport(user.id, format);
  }

  /**
   * Get user's export history
   */
  @Get('history')
  async getExportHistory(@CurrentUser() user: any) {
    return this.exportService.getUserExportHistory(user.id);
  }

  /**
   * Download completed export file
   */
  @Get('download/:exportId')
  async downloadExportFile(
    @CurrentUser() user: any,
    @Param('exportId') exportId: string,
    @Res() res: Response,
  ) {
    const exportFile = await this.exportService.getCompletedExportFile(user.id, exportId);

    res.setHeader('Content-Type', exportFile.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    res.send(exportFile.content);
  }

  /**
   * Get available export formats
   */
  @Get('formats')
  getAvailableFormats() {
    return {
      formats: [
        {
          name: 'json',
          mimeType: 'application/json',
          description: 'JSON format - structured data, machine-readable',
        },
        {
          name: 'csv',
          mimeType: 'text/csv',
          description: 'CSV format - spreadsheet compatible',
        },
        {
          name: 'pdf',
          mimeType: 'application/pdf',
          description: 'PDF format - readable document',
        },
      ],
    };
  }
}
