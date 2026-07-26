import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { PaymentReconciliationJob } from './reconciliation.service';

@ApiTags('Payments')
@Controller('payments/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentReconciliationController {
  constructor(private readonly reconciliationJob: PaymentReconciliationJob) {}

  @Get('report')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the latest payment reconciliation report (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns the latest reconciliation report' })
  getReport() {
    return this.reconciliationJob.getLastReport();
  }
}
