import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { SecurityModule } from '../security/security.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { User } from '../users/entities/user.entity';

import { createJwtOptions } from './config/jwt-config.factory';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { MfaController } from './mfa/mfa.controller';
import { MfaService } from './mfa/mfa.service';
import { SocialAuthController } from './controllers/social-auth.controller';
import { AuthTokensService } from './services/auth-tokens.service';
import { SocialAuthService } from './services/social-auth.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { GitHubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

/**
 * Registers the authentication module with Passport and JWT support.
 *
 * Issue #801: AuthTokensService is registered here so password-reset and
 * email-verification flows can persist only SHA-256 hashes (never raw tokens).
 * Issue #799: SecurityModule is imported so SocialAuthService has access to
 * the EncryptionService for at-rest OAuth token protection.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createJwtOptions(configService),
    }),
    TypeOrmModule.forFeature([User]),
    SecurityModule,
    TenancyModule,
    RbacModule,
    AuditLogModule,
  ],
  controllers: [AuthController, SocialAuthController, MfaController],
  providers: [
    JwtStrategy,
    AuthService,
    TokenBlacklistService,
    GoogleStrategy,
    GitHubStrategy,
    SocialAuthService,
    AuthTokensService,
    MfaService,
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
