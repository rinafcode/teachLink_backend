import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { ensureUserExists, ensureUserDoesNotExist } from '../common/utils/user.utils';
import { paginate, IPaginatedResponse } from '../common/utils/pagination.util';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { sanitizeSqlLike, enforceWhitelistedValue } from '../common/utils/sanitization.utils';
import { GetUsersDto } from './dto/get-users.dto';
import { CachingService } from '../caching/caching.service';
import { CACHE_TTL, CACHE_PREFIXES, CACHE_EVENTS } from '../caching/caching.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { USER_CONSTANTS } from './user.constants';

/**
 * Provides user operations.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cachingService: CachingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates a new record.
   * @param createUserDto The request payload.
   * @returns The resulting user.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
      withDeleted: true,
    });
    ensureUserDoesNotExist(existingUser, 'User with this email already exists');

    // Hash password
    const bcryptRounds =
      this.configService.get<number>('BCRYPT_ROUNDS') || USER_CONSTANTS.BCRYPT_ROUNDS;
    const hashedPassword = await bcrypt.hash(createUserDto.password, bcryptRounds);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return await this.userRepository.save(user);
  }

  async findAll(filter?: GetUsersDto): Promise<IPaginatedResponse<User>> {
    const cacheKey = `${CACHE_PREFIXES.USERS_LIST}:${JSON.stringify(filter || {})}`;

    return this.cachingService.getOrSet(
      cacheKey,
      async () => {
        const query = this.userRepository.createQueryBuilder('user');

        if (filter?.role) {
          const role = enforceWhitelistedValue(filter.role, Object.values(UserRole), 'role');
          query.andWhere('user.role = :role', { role });
        }

        if (filter?.status) {
          const status = enforceWhitelistedValue(
            filter.status,
            Object.values(UserStatus),
            'status',
          );
          query.andWhere('user.status = :status', { status });
        }

        if (filter?.search) {
          const safeSearch = sanitizeSqlLike(filter.search);
          // eslint-disable-next-line quotes
          query.andWhere(
            "(user.email ILIKE :search ESCAPE '\\' OR user.firstName ILIKE :search ESCAPE '\\' OR user.lastName ILIKE :search ESCAPE '\\')", // eslint-disable-line quotes
            { search: `%${safeSearch}%` },
          );
        }

        return await paginate(query, filter || new PaginationQueryDto());
      },
      CACHE_TTL.USER_PROFILE,
    );
  }

  /**
   * Retrieves records by their identifiers.
   * @param ids The identifiers.
   * @returns The matching results.
   */
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

  /**
   * Retrieves the requested record.
   * @param id The identifier.
   * @returns The resulting user.
   */
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

  /**
   * Retrieves a record by email address.
   * @param email The email address.
   * @returns The operation result.
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  /**
   * Retrieves a record by password reset token.
   * @param token The token value.
   * @returns The operation result.
   */
  async findByPasswordResetToken(token: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { passwordResetToken: token },
    });
  }

  /**
   * Retrieves a record by email verification token.
   * @param token The token value.
   * @returns The operation result.
   */
  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateUserDto The request payload.
   * @returns The resulting user.
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findUserOrThrow(id);

    if (updateUserDto.password) {
      const plainPassword = updateUserDto.password;

      if (await bcrypt.compare(plainPassword, user.password)) {
        throw new BadRequestException('New password must be different from the current password');
      }

      const recentPasswords = user.passwordHistory ?? [];
      for (const oldHash of recentPasswords.slice(-5)) {
        if (await bcrypt.compare(plainPassword, oldHash)) {
          throw new BadRequestException('New password must not match your last 5 passwords');
        }
      }

      // Append current, maintain last 5 entries
      user.passwordHistory = [...recentPasswords, user.password].slice(-5);

      const bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS') || 10;
      updateUserDto.password = await bcrypt.hash(plainPassword, bcryptRounds);
    }

    Object.assign(user, updateUserDto);
    const saved = await this.userRepository.save(user);

    // Invalidate cache after update
    this.eventEmitter.emit(CACHE_EVENTS.USER_UPDATED, { userId: id });

    return saved;
  }

  /**
   * Updates the stored refresh token.
   * @param userId The user identifier.
   * @param refreshToken The token value.
   */
  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: refreshToken as unknown as string });
    // Invalidate user cache
    this.eventEmitter.emit(CACHE_EVENTS.USER_UPDATED, { userId });
  }

  /**
   * Updates the password reset token.
   * @param userId The user identifier.
   * @param token The token value.
   * @param expires The expires.
   */
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

  /**
   * Updates the email verification token.
   * @param userId The user identifier.
   * @param token The token value.
   * @param expires The expires.
   */
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

  /**
   * Updates the last login timestamp.
   * @param userId The user identifier.
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   */
  async remove(id: string): Promise<void> {
    await this.findUserOrThrow(id);
    await this.userRepository.softDelete(id);

    // Invalidate cache after delete
    this.eventEmitter.emit(CACHE_EVENTS.USER_DELETED, { userId: id });
  }

  async bulkUpdate(
    ids: string[],
    updateData: UpdateUserDto,
  ): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [], failed: [] };

    for (const id of ids) {
      try {
        await this.update(id, updateData);
        results.success.push(id);
      } catch (_error) {
        results.failed.push(id);
      }
    }

    return results;
  }

  async bulkRemove(ids: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [], failed: [] };

    for (const id of ids) {
      try {
        await this.remove(id);
        results.success.push(id);
      } catch (_error) {
        results.failed.push(id);
      }
    }

    return results;
  }
}
