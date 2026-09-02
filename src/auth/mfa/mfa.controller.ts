import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CustomThrottleGuard } from '../../common/guards/throttle.guard';
import { THROTTLE } from '../../common/constants/throttle.constants';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * MFA endpoints are authentication-sensitive: `verify` and `disable` both
 * accept a TOTP code and are prime brute-force targets. Every handler is
 * therefore covered by CustomThrottleGuard on top of JWT auth. Limits use the
 * shared, documented THROTTLE presets (strictest on code verification) rather
 * than hardcoded numbers; exceeding a limit returns 429.
 */
@ApiTags('MFA')
@Controller('mfa')
@UseGuards(JwtAuthGuard, CustomThrottleGuard)
@Throttle({ default: THROTTLE.AUTH_DEFAULT })
@ApiBearerAuth()
@ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded' })
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Setup TOTP MFA' })
  async setup(@Req() req: any) {
    return this.mfaService.generateTotpSecret(req.user);
  }

  @Post('verify')
  @Throttle({ default: THROTTLE.AUTH_LOGIN })
  @ApiOperation({ summary: 'Verify initial TOTP setup' })
  async verify(@Req() req: any, @Body('code') code: string) {
    return this.mfaService.verifySetup(req.user, code);
  }

  @Post('disable')
  @Throttle({ default: THROTTLE.AUTH_LOGIN })
  @ApiOperation({ summary: 'Disable TOTP MFA' })
  async disable(@Req() req: any, @Body('code') code: string) {
    return this.mfaService.disableMfa(req.user, code);
  }
}
