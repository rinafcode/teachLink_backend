import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecretsManagerService } from './secrets-manager.service';
import { VaultSecretsService } from './vault-secrets.service';
import { SecretsController } from './secrets.controller';
import { THROTTLE } from '../../common/constants/throttle.constants';

@Module({
  // Register a throttler so CustomThrottleGuard has storage/config to enforce
  // the per-handler @Throttle presets applied in SecretsController. The
  // baseline mirrors the MODERATE preset; individual handlers tighten it.
  imports: [
    ThrottlerModule.forRoot([{ ttl: THROTTLE.MODERATE.ttl, limit: THROTTLE.MODERATE.limit }]),
  ],
  controllers: [SecretsController],
  providers: [SecretsManagerService, VaultSecretsService],
  exports: [SecretsManagerService, VaultSecretsService],
})
export class SecretsModule {}
