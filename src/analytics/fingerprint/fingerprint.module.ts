import { Module } from '@nestjs/common';
import { FingerprintService } from './fingerprint.service';
import { FingerprintInterceptor } from './fingerprint.interceptor';

@Module({
  providers: [FingerprintService, FingerprintInterceptor],
  exports: [FingerprintService, FingerprintInterceptor],
})
export class FingerprintModule {}
