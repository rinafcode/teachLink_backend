import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Registers the authentication module with Passport and Auth0 JWT support.
 * Bundles PassportModule and registers the dynamic Auth0 JWKS JWT strategy.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m', },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [JwtStrategy, RolesGuard, PermissionsGuard],
  exports: [PassportModule, JwtModule, JwtStrategy, RolesGuard, PermissionsGuard],
})
export class AuthModule {}
