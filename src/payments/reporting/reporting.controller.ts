import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('reconciliation/daily')
  async getDailyReconciliation(@Query('date') dateStr: string) {
    if (!dateStr) {
      throw new BadRequestException('Query parameter "date" is required (YYYY-MM-DD)');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    return this.reportingService.generateDailyReconciliationReport(date);
  }

  @Get('refunds')
  async getRefundsReport(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
  ) {
    const { startDate, endDate } = this.parseDateRange(startDateStr, endDateStr);
    return this.reportingService.generateRefundReport(startDate, endDate);
  }

  @Get('revenue')
  async getRevenueReport(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
  ) {
    const { startDate, endDate } = this.parseDateRange(startDateStr, endDateStr);
    return this.reportingService.generateRevenueRecognitionReport(startDate, endDate);
  }

  @Get('tax')
  async getTaxReport(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
  ) {
    const { startDate, endDate } = this.parseDateRange(startDateStr, endDateStr);
    return this.reportingService.generateTaxReport(startDate, endDate);
  }

  private parseDateRange(startDateStr: string, endDateStr: string) {
    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('Both "startDate" and "endDate" query parameters are required');
    }
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format for startDate or endDate');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    return { startDate, endDate };
  }
}
