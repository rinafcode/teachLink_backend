import { UsersService } from './users.service';
import { UserRole, UserStatus } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import {
  createMockRepository,
  createMockCachingService,
  createMockQueryBuilder,
  createMockEventEmitter,
} from 'test/utils/mock-factories';
import { Repository } from 'typeorm';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepository: jest.Mocked<Repository<any>>;
  let mockCachingService: jest.Mocked<any>;
  let mockEventEmitter: jest.Mocked<any>;

  beforeEach(() => {
    // ─── Initialize Mocks ──────────────────────────────────────────────────
    mockUserRepository = createMockRepository();
    mockCachingService = createMockCachingService();
    mockEventEmitter = createMockEventEmitter();

    // ─── Configure Default QueryBuilder ────────────────────────────────────
    const mockQueryBuilder = createMockQueryBuilder();
    mockQueryBuilder.getMany.mockResolvedValue([
      { id: 'user-1', email: 'test@example.com' },
    ]);
    mockQueryBuilder.getCount.mockResolvedValue(1);
    mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

    // ─── Service Instantiation ─────────────────────────────────────────────
    service = new UsersService(
      mockUserRepository,
      mockCachingService,
      mockEventEmitter,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes search input and uses parameterized ILIKE', async () => {
    const mockQueryBuilder = createMockQueryBuilder();
    mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

    const maliciousSearch = "a%_b\\ test' OR 1=1 --";

    await expect(
      service.findAll({
        search: maliciousSearch,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      }),
    ).resolves.toBeDefined();

    expect(mockUserRepository.createQueryBuilder).toHaveBeenCalledWith('user');

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      "(user.email ILIKE :search ESCAPE '\\' OR user.firstName ILIKE :search ESCAPE '\\' OR user.lastName ILIKE :search ESCAPE '\\')",
      {
        search: "%a\\%\\_b\\\\ test' OR 1=1 --%",
      },
    );
  });

  it('blocks non-whitelisted role values', async () => {
    await expect(service.findAll({ role: 'hacker' as any })).rejects.toThrow(
      /Invalid value for role/,
    );
  });

  it('blocks non-whitelisted status values', async () => {
    await expect(service.findAll({ status: 'hacked' as any })).rejects.toThrow(
      /Invalid value for status/,
    );
  });

  it('rejects password reuse via current password', async () => {
    const currentHash = await bcrypt.hash('CurrentPass1!', 10);

    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password: currentHash,
      passwordHistory: [],
    });
    mockUserRepository.save.mockResolvedValue(true as any);

    await expect(service.update('user-1', { password: 'CurrentPass1!' })).rejects.toThrow(
      /New password must be different from the current password/,
    );
  });

  it('rejects password reuse via history', async () => {
    const currentHash = await bcrypt.hash('CurrentPass1!', 10);
    const oldHash = await bcrypt.hash('OldPass1!', 10);

    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password: currentHash,
      passwordHistory: [oldHash],
    });
    mockUserRepository.save.mockResolvedValue(true as any);

    await expect(service.update('user-1', { password: 'OldPass1!' })).rejects.toThrow(
      /New password must not match your last 5 passwords/,
    );
  });

  it('updates password and appends current password to history', async () => {
    const currentHash = await bcrypt.hash('CurrentPass1!', 10);

    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password: currentHash,
      passwordHistory: [],
    });
    mockUserRepository.save.mockImplementation(async (user: any) => user);

    const result = await service.update('user-1', { password: 'NewPass1!' });

    expect(result.password).not.toBe('NewPass1!');
    expect(await bcrypt.compare('NewPass1!', result.password)).toBe(true);
    expect(result.passwordHistory).toEqual([currentHash]);
  });
});
