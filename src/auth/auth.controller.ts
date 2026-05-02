import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, VerifyEmailDto, } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * Exposes auth endpoints.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registers register.
   * @param registerDto The request payload.
   * @param req The req.
   * @returns The operation result.
   */
  @Post('register')
  @Throttle({ default: THROTTLE.STRICT })
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request): Promise<any> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  /**
   * Executes login.
   * @param loginDto The request payload.
   * @param req The req.
   * @returns The operation result.
   */
  @Post('login')
  @Throttle({ default: THROTTLE.AUTH_LOGIN })
  @ApiOperation({ summary: 'Login user and get tokens' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<any> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  /**
   * Refreshes refresh.
   * @param refreshTokenDto The request payload.
   * @returns The operation result.
   */
  @Post('refresh')
  @Throttle({ default: THROTTLE.REFRESH })
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<any> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  /**
   * Executes logout.
   * @param user The user.
   * @param req The req.
   * @returns The operation result.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user (invalidate refresh token)' })
  async logout(@CurrentUser() user: any, @Req() req: Request): Promise<any> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.logout(user.userId, user.sessionId, ipAddress, userAgent);
  }

  /**
   * Executes forgot Password.
   * @param forgotPasswordDto The request payload.
   * @returns The operation result.
   */
  @Post('forgot-password')
  @Throttle({ default: THROTTLE.AUTH_DEFAULT })
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  /**
   * Resets password.
   * @param resetPasswordDto The request payload.
   * @returns The operation result.
   */
  @Post('reset-password')
  @Throttle({ default: THROTTLE.AUTH_DEFAULT })
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<any> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  /**
   * Executes change Password.
   * @param user The user.
   * @param changePasswordDto The request payload.
   * @param req The req.
   * @returns The operation result.
   */
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

  /**
   * Validates email.
   * @param verifyEmailDto The request payload.
   * @returns The operation result.
   */
  @Post('verify-email')
  @Throttle({ default: THROTTLE.MODERATE })
  @ApiOperation({ summary: 'Verify email using token' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<any> {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }
}
