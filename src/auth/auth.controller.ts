import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ThreatDetectionService } from '../security/threats/threat-detection.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { BadRequestException } from '@nestjs/common';
import { InvalidCredentialsException } from '../common/exceptions/app.exceptions';

/**
 * Best-effort client IP extraction. We deliberately use `req.ip` (Express)
 * which respects `app.set('trust proxy', …)` — configured in `src/main.ts`
 * so reverse proxies do not poison the key. If we cannot resolve ANY IP
 * (e.g. a unit test that did not provide a socket, or a misconfigured
 * production deployment missing the trusted-proxy hop), throw a 400 so
 * the misconfiguration surfaces loudly rather than silently bucketing
 * unrelated requests together.
 */
function extractClientIp(req: any): string {
  const directIp = req?.ip;
  if (typeof directIp === 'string' && directIp.length > 0) return directIp;
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0];
  throw new BadRequestException('Unable to determine client IP for rate limiting');
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly threatDetection: ThreatDetectionService,
  ) {}

  // ─── Issue #798 — Per-IP threat counter wrapper around login ───────────
  // The login flow is the natural choke-point: every failed credential is
  // a brute-force attempt, and the per-IP counter is the only thing that
  // prevents a credential stuffing attack from spreading across pods.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Too many failed attempts from this IP' })
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const ip = extractClientIp(req);
    // Step 1 — refuse early if this IP is already over the failure threshold.
    await this.threatDetection.analyzeRequest(ip);

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      relations: ['roles'],
    });
    if (!user) {
      await this.threatDetection.recordFailure(ip);
      throw new InvalidCredentialsException();
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatches) {
      await this.threatDetection.recordFailure(ip);
      throw new InvalidCredentialsException();
    }

    // Successful login — wipe the failure counter.
    await this.threatDetection.reset(ip);
    return this.authService.login(user);
  }

  // ─── Issue #801 — SHA-256-hashed reset & verification flows ─────────────
  // These three endpoints turn the SHA-256-hashed AuthTokensService into
  // real, callable flows. The raw token never reaches the User row — only
  // its SHA-256 hash does.

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password-reset email (Issue #801)',
    description:
      'Issues a SHA-256-hashed reset token. Returns success without revealing whether the email exists. In non-production environments the raw token is also returned so dev/QA can complete the flow end-to-end.',
  })
  @ApiResponse({ status: 200, description: 'Reset email dispatched' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using a SHA-256-hashed token (Issue #801)',
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Token invalid or expired' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const user = await this.authService.resetPassword(dto.token, dto.newPassword);
    return { id: user.id, email: user.email };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify an email address using a SHA-256-hashed token (Issue #801)',
  })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 401, description: 'Token invalid or expired' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const user = await this.authService.verifyEmailToken(dto.token);
    return { id: user.id, email: user.email, isEmailVerified: user.isEmailVerified };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiResponse({ status: 200, description: 'Successfully refreshed tokens' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    // Note: In a real implementation, you might want to decode the refresh token first
    // to get the userId without needing it in the request body, or require a separate strategy.
    // For this, we'll extract the userId from the payload inside the service after verifying the token.

    // Actually, our service needs userId. Let's fix auth.service to decode and find userId.
    // We will pass just the token to the service.
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and invalidate refresh token' })
  async logout(@Req() req: any) {
    const authHeader: string | undefined = req.headers?.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    await this.authService.logout(req.user.id, accessToken);
    return { message: 'Logged out successfully' };
  }
}
