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
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-jwt-secret',
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
