import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('MFA')
@Controller('mfa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Setup TOTP MFA' })
  async setup(@Req() req: any) {
    return this.mfaService.generateTotpSecret(req.user);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify initial TOTP setup' })
  async verify(@Req() req: any, @Body('code') code: string) {
    return this.mfaService.verifySetup(req.user, code);
  }

  @Post('disable')
  @ApiOperation({ summary: 'Disable TOTP MFA' })
  async disable(@Req() req: any, @Body('code') code: string) {
    return this.mfaService.disableMfa(req.user, code);
  }
}
