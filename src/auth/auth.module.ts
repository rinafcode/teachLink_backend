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

/**
 * Registers the authentication module with Passport and JWT support.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController, SocialAuthController],
  providers: [
    JwtStrategy,
    AuthService,
    TokenBlacklistService,
    GoogleStrategy,
    GitHubStrategy,
    SocialAuthService,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    PassportModule,
    JwtModule,
    AuthService,
    SocialAuthService,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
