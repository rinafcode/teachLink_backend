import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReconciliationService, ReconciliationReport } from './reconciliation.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

/**
 * Controller for payment reconciliation endpoints.
 * Provides admin-only access to reconciliation reports.
 */
@ApiTags('Payments - Reconciliation')
@ApiBearerAuth()
@Controller('payments/reconciliation')
@UseGuards(RolesGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  /**
   * Get the last reconciliation report
   * GET /payments/reconciliation/report
   */
  @Get('report')
  @Roles('admin')
  @ApiOperation({
    summary: 'Get last reconciliation report',
    description: 'Returns the results of the most recent payment reconciliation run. Admin-only endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation report retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        runAt: { type: 'string', format: 'date-time' },
        startDate: { type: 'string', format: 'date-time' },
        endDate: { type: 'string', format: 'date-time' },
        totalProviderTransactions: { type: 'number' },
        totalLocalPayments: { type: 'number' },
        matchedTransactions: { type: 'number' },
        unmatchedProviderTransactions: { type: 'array', items: { type: 'object' } },
        unmatchedLocalPayments: { type: 'array', items: { type: 'object' } },
        mismatches: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'No reconciliation report available',
  })
  getLastReport(): ReconciliationReport | null {
    return this.reconciliationService.getLastReport();
  }
}
