import { Controller, Get, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../../common/constants/throttle.constants';
import { CustomThrottleGuard } from '../../common/guards/throttle.guard';
import { Request } from 'express';
import { GoogleOAuthGuard } from '../guards/google-oauth.guard';
import { GitHubOAuthGuard } from '../guards/github-oauth.guard';

@ApiTags('auth')
@Controller('auth')
@UseGuards(CustomThrottleGuard)
export class SocialAuthController {
  @Get('google')
  @Throttle({ default: THROTTLE.AUTH_DEFAULT })
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth2 login' })
  @HttpCode(HttpStatus.FOUND)
  googleLogin(): void {
    // Passport redirects to Google — no body needed
  }

  @Get('google/callback')
  @Throttle({ default: THROTTLE.MODERATE })
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  googleCallback(@Req() req: Request): { user: Express.User | undefined } {
    return { user: req.user };
  }

  @Get('github')
  @Throttle({ default: THROTTLE.AUTH_DEFAULT })
  @UseGuards(GitHubOAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth2 login' })
  @HttpCode(HttpStatus.FOUND)
  githubLogin(): void {
    // Passport redirects to GitHub — no body needed
  }

  @Get('github/callback')
  @Throttle({ default: THROTTLE.MODERATE })
  @UseGuards(GitHubOAuthGuard)
  @ApiOperation({ summary: 'GitHub OAuth2 callback' })
  githubCallback(@Req() req: Request): { user: Express.User | undefined } {
    return { user: req.user };
  }
}
