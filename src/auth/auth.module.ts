import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { SocialAuthService } from './services/social-auth.service';
import { SocialAuthController } from './controllers/social-auth.controller';
import { AuthTokensService } from './services/auth-tokens.service';
// Issue #799 — EncryptionService is required to encrypt OAuth provider tokens
// (providerAccessToken / providerRefreshToken) at rest. SecurityModule is the
// only module that provides EncryptionService, so it must be imported here.
import { SecurityModule } from '../security/security.module';

/**
 * Registers the authentication module with Passport and JWT support.
 *
 * Issue #801 — AuthTokensService is registered here so password-reset and
 * email-verification flows can persist only SHA-256 hashes (never raw tokens).
 * Issue #799 — SecurityModule is imported so SocialAuthService has access to
 * the EncryptionService for at-rest OAuth token protection.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
    TypeOrmModule.forFeature([User]),
    SecurityModule,
  ],
  controllers: [AuthController, SocialAuthController],
  providers: [
    JwtStrategy,
    AuthService,
    TokenBlacklistService,
    GoogleStrategy,
    GitHubStrategy,
    SocialAuthService,
    AuthTokensService,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    PassportModule,
    JwtModule,
    AuthService,
    SocialAuthService,
    AuthTokensService,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
