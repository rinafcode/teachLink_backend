import { Module } from '@nestjs/common';
import { SecretsManagerService } from './secrets-manager.service';
import { VaultSecretsService } from './vault-secrets.service';
import { SecretsController } from './secrets.controller';

@Module({
  controllers: [SecretsController],
  providers: [SecretsManagerService, VaultSecretsService],
  exports: [SecretsManagerService, VaultSecretsService],
})
export class SecretsModule {}
