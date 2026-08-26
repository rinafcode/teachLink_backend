import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SecretsManagerService } from './secrets-manager.service';
import { VaultSecretsService } from './vault-secrets.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CustomThrottleGuard } from '../../common/guards/throttle.guard';
import { THROTTLE } from '../../common/constants/throttle.constants';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Secret-management endpoints are highly sensitive: they read and rotate
 * credentials held in AWS Secrets Manager / HashiCorp Vault. On top of the
 * admin-only authorization we throttle every handler so a leaked or misused
 * admin token cannot be used to brute-force or hammer the secret backends.
 *
 * Limits come from the shared {@link THROTTLE} presets (documented and
 * configurable) rather than hardcoded magic numbers — rotation, the most
 * destructive action, uses the strictest preset.
 */
@ApiTags('secrets')
@Controller('secrets')
@UseGuards(JwtAuthGuard, RolesGuard, CustomThrottleGuard)
@Throttle({ default: THROTTLE.MODERATE })
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Authentication required' })
@ApiResponse({ status: 403, description: 'Admin role required' })
@ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded' })
export class SecretsController {
  constructor(
    private readonly secretsManagerService: SecretsManagerService,
    private readonly vaultSecretsService: VaultSecretsService,
  ) {}

  @Get('aws/:secretName')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get secret from AWS Secrets Manager' })
  @ApiResponse({ status: 200, description: 'Secret lookup result with redacted value' })
  async getAWSSecret(@Param('secretName') secretName: string) {
    const value = await this.secretsManagerService.getSecret(secretName);
    return { secretName, value: value ? '***REDACTED***' : null };
  }

  @Get('vault/:secretName')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get secret from HashiCorp Vault' })
  @ApiResponse({ status: 200, description: 'Vault secret lookup result with redacted value' })
  async getVaultSecret(@Param('secretName') secretName: string) {
    const value = await this.vaultSecretsService.getSecret(secretName);
    return { secretName, value: value ? '***REDACTED***' : null };
  }

  @Post('aws/rotate/:secretName')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: THROTTLE.STRICT })
  @ApiOperation({ summary: 'Rotate secret in AWS Secrets Manager' })
  @ApiResponse({ status: 201, description: 'AWS secret rotated' })
  async rotateAWSSecret(@Param('secretName') secretName: string) {
    await this.secretsManagerService.rotateSecret(secretName);
    return { message: `Secret ${secretName} rotated successfully` };
  }

  @Post('vault/rotate/:secretName')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: THROTTLE.STRICT })
  @ApiOperation({ summary: 'Rotate secret in HashiCorp Vault' })
  @ApiResponse({ status: 201, description: 'Vault secret rotated' })
  async rotateVaultSecret(@Param('secretName') secretName: string) {
    await this.vaultSecretsService.rotateSecret(secretName);
    return { message: `Secret ${secretName} rotated successfully in Vault` };
  }

  @Post('cache/clear')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Clear secret cache' })
  @ApiResponse({ status: 201, description: 'Secret cache cleared' })
  async clearCache() {
    this.secretsManagerService.clearCache();
    return { message: 'Secret cache cleared' };
  }
}
