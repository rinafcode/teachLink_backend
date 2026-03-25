import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../users/entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
}

interface ValidatedUser {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    return { sub: payload.sub, email: payload.email, role: payload.role, sid: payload.sid };
  }
}
