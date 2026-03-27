import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { ensureUserExists, ensureUserDoesNotExist } from '../common/utils/user.utils';
import { paginate, PaginatedResponse } from '../common/utils/pagination.util';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { GetUsersDto } from './dto/get-users.dto';
import { CachingService } from '../caching/caching.service';
import { CACHE_TTL, CACHE_PREFIXES, CACHE_EVENTS } from '../caching/caching.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cachingService: CachingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });
    ensureUserDoesNotExist(existingUser, 'User with this email already exists');

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return await this.userRepository.save(user);
  }

  async findAll(filter?: GetUsersDto): Promise<PaginatedResponse<User>> {
    const cacheKey = `cache:users:list:${JSON.stringify(filter || {})}`;

    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const query = this.userRepository.createQueryBuilder('user');

        if (filter?.role) {
          query.andWhere('user.role = :role', { role: filter.role });
        }

        if (filter?.status) {
          query.andWhere('user.status = :status', { status: filter.status });
        }

        if (filter?.search) {
          query.andWhere(
            '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
            { search: `%${filter.search}%` },
          );
        }

        return await paginate(query, filter || new PaginationQueryDto());
      },
      CACHE_TTL.USER_PROFILE,
    );
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return await this.userRepository.findByIds(ids);
  }

  /**
   * Helper method to find a user by ID or throw NotFoundException.
   * Can be used internally to eliminate duplication.
   */
  async findUserOrThrow(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    return ensureUserExists(user, 'User not found');
  }

  async findOne(id: string): Promise<User> {
    const cacheKey = `${CACHE_PREFIXES.USER_PROFILE}:${id}`;

    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        return await this.findUserOrThrow(id);
      },
      CACHE_TTL.USER_PROFILE,
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { passwordResetToken: token },
    });
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findUserOrThrow(id);

    // If updating password, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    const saved = await this.userRepository.save(user);

    // Invalidate cache after update
    this.eventEmitter.emit(CACHE_EVENTS.USER_UPDATED, { userId: id });

    return saved;
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: refreshToken as unknown as string });
    // Invalidate user cache
    this.eventEmitter.emit(CACHE_EVENTS.USER_UPDATED, { userId });
  }

  async updatePasswordResetToken(
    userId: string,
    token: string | null,
    expires: Date | null,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      passwordResetToken: token as unknown as string,
      passwordResetExpires: expires as unknown as Date,
    });
  }

  async updateEmailVerificationToken(
    userId: string,
    token: string | null,
    expires: Date | null,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      emailVerificationToken: token as unknown as string,
      emailVerificationExpires: expires as unknown as Date,
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }

  async remove(id: string): Promise<void> {
    const user = await this.findUserOrThrow(id);
    await this.userRepository.remove(user);

    // Invalidate cache after delete
    this.eventEmitter.emit(CACHE_EVENTS.USER_DELETED, { userId: id });
  }
}
