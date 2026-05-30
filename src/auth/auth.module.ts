import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Registers the authentication module with Passport and Auth0 JWT support.
 * Bundles PassportModule and registers the dynamic Auth0 JWKS JWT strategy.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [JwtStrategy],
  exports: [PassportModule, JwtStrategy],
})
export class AuthModule {}
