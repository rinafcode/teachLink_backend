import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { SocialAuthService } from './services/social-auth.service';
import { SocialAuthController } from './controllers/social-auth.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '900', 10) },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [SocialAuthController],
  providers: [
    JwtStrategy,
    GoogleStrategy,
    GitHubStrategy,
    SocialAuthService,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    PassportModule,
    JwtModule,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    SocialAuthService,
  ],
})
export class AuthModule {}
