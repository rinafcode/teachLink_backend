import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { isRS256Configured, loadPEMKey } from './config/jwt-config.factory';
import { RolesService } from '../rbac/roles/roles.service';
import { TokenBlacklistService } from './services/token-blacklist.service';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  jti: string;
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
    private readonly rolesService: RolesService,
    private readonly tokenBlacklistService: TokenBlacklistService,
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
    if (payload.jti) {
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    const user = await this.userRepository.findOneBy({ id: payload.sub });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    const userWithRolesAndPermissions = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .where('user.id = :id', { id: user.id })
      .getOne();

    if (!userWithRolesAndPermissions) {
      throw new Error('User not found');
    }

    const activeRoles = await Promise.all(
      (userWithRolesAndPermissions.roles ?? []).map(async (role) => ({
        role,
        active: await this.rolesService.isRoleActive(role.name),
      })),
    );

    const roles = activeRoles.filter((entry) => entry.active).map((entry) => entry.role);
    
    // Resolve permissions using the RBAC cache
    const permissions: string[] = [];
    for (const role of roles) {
      const rolePermissions = await this.rolesService.getCachedRolePermissions(role.id);
      rolePermissions.forEach((p) => {
        permissions.push(`${p.resource}:${p.action}`);
      });
    }

    userWithRolesAndPermissions.roles = roles;
    (userWithRolesAndPermissions as User & { permissions: string[] }).permissions = Array.from(new Set(permissions));

    return userWithRolesAndPermissions;
  }
}
