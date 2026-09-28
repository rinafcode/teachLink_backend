import { Module, forwardRef } from '@nestjs/common';
import { FingerprintService } from './fingerprint.service';
import { FingerprintInterceptor } from './fingerprint.interceptor';
import { AnalyticsModule } from '../analytics.module';

@Module({
  imports: [forwardRef(() => AnalyticsModule)],
  providers: [FingerprintService, FingerprintInterceptor],
  exports: [FingerprintService, FingerprintInterceptor],
})
export class FingerprintModule {}
