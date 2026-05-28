import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';

/**
 * Registers the authentication module with Passport and JWT support.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [JwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
