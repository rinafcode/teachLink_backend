import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request): Promise<any> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @ApiOperation({ summary: 'Login user and get tokens' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<any> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<any> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user (invalidate refresh token)' })
  async logout(@CurrentUser() user: any, @Req() req: Request): Promise<any> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.logout(user.userId, user.sessionId, ipAddress, userAgent);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<any> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<any> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.changePassword(user.userId, changePasswordDto, ipAddress, userAgent);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 requests per hour
  @ApiOperation({ summary: 'Verify email using token' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<any> {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }
}
