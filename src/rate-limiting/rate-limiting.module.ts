import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { QuotaDefinition } from './entities/quota-definition.entity';
import { UserQuotaUsage } from './entities/user-quota-usage.entity';

// Services
import { QuotaManagementService } from './services/quota.service';
import { QuotaDefinitionService } from './services/quota-definition.service';
import { QuotaTrackingService } from './services/quota-tracking.service';
import { QuotaResetScheduler } from './services/quota-reset.scheduler';
import { AdaptiveRateLimitingService } from './services/adaptive-rate-limiting.service';
import { ContainerCpuMetricsService } from './services/container-cpu-metrics.service';

// Guard & Decorator
import { QuotaGuard } from './guards/quota.guard';

// Controller
import { QuotaController } from './controllers/quota.controller';
import { UserQuotaController } from './controllers/user-quota.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QuotaDefinition, UserQuotaUsage])],
  controllers: [QuotaController, UserQuotaController],
  providers: [
    QuotaDefinitionService,
    QuotaTrackingService,
    QuotaManagementService,
    QuotaResetScheduler,
    AdaptiveRateLimitingService,
    ContainerCpuMetricsService,
    QuotaGuard,
  ],
  exports: [QuotaManagementService, QuotaDefinitionService, QuotaTrackingService, QuotaGuard],
})
export class RateLimitingModule implements OnModuleInit {
  constructor(private readonly definitions: QuotaDefinitionService) {}

  /** Seed default quota definitions on first boot. */
  async onModuleInit(): Promise<void> {
    await this.definitions.seedDefaults();
  }
}
