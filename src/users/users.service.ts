import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

export interface UserSearchResult {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  email?: string;
  status?: string;
  isEmailVerified?: boolean;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

  async searchUsers(
    query?: string,
    role?: string,
    page = 1,
    limit = 20,
  ): Promise<UserSearchResult[]> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .distinct(true)
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.username',
        'user.profilePicture',
        'user.email',
        'user.status',
        'user.isEmailVerified',
        'role.id',
        'role.name',
      ]);

    if (query) {
      const search = `%${query.trim()}%`;
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.username ILIKE :search)',
        { search },
      );
    }

    if (role) {
      qb.andWhere('role.name = :role', { role: role.toLowerCase() });
    }

    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const users = await qb.getMany();

    return users.map((user) => {
      const joinedRole =
        user.roles && user.roles.length > 0 ? (user.roles[0].name as UserRole) : undefined;

      return {
        id: user.id,
        displayName:
          user.username?.trim() ||
          `${user.firstName?.trim() ?? ''} ${user.lastName?.trim() ?? ''}`.trim(),
        avatarUrl: user.profilePicture,
        role: joinedRole ?? UserRole.STUDENT,
        email: user.email,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
      };
    });
  }
}
