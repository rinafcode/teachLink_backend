import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Passport JWT strategy for validating Bearer tokens.
 * Supports HS256 (symmetric) and RS256 (asymmetric) key verification
 * via secretOrKeyProvider for runtime key rotation.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (_request, _rawJwtToken, done) => {
        try {
          if (isRS256Configured()) {
            const pubKey = process.env.JWT_PUBLIC_KEY || '';
            const resolved = loadPEMKey(pubKey) || pubKey;
            done(null, resolved);
          } else {
            done(null, process.env.JWT_SECRET || 'default-jwt-secret');
          }
        } catch (err) {
          this.logger.error('Failed to resolve JWT verification key', err);
          done(err, undefined);
        }
      },
    });
  }

  /**
   * Validates the decoded JWT payload and returns the user object.
   * @param payload The decoded JWT payload.
   * @returns The authenticated user with roles and permissions.
   */
  async validate(payload: JwtPayload): Promise<any> {
    const user = await this.userRepository.findOneBy({ id: payload.sub });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    // Fetch roles and permissions for the user
    const userWithRolesAndPermissions = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.id = :id', { id: user.id })
      .getOne();

    if (!userWithRolesAndPermissions) {
      throw new Error('User not found');
    }

    const roles = userWithRolesAndPermissions.roles.map((role) => role.name);
    const permissions = userWithRolesAndPermissions.roles.reduce((acc, role) => {
      return acc.concat(role.permissions.map((p) => `${p.resource}:${p.action}`));
    }, [] as string[]);

    return {
      ...payload,
      roles,
      permissions,
    };
  }
}
