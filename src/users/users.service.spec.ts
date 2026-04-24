import { UsersService } from './users.service';
import { UserRole, UserStatus } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let service: UsersService;
  let queryBuilder: any;
  let userRepository: any;
  let cachingService: any;

  beforeEach(() => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }]),
    };

    userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    cachingService = {
      getOrSet: jest.fn().mockImplementation(async (_key: string, handler: any) => handler()),
    };

    service = new UsersService(
      userRepository,
      cachingService,
      { emit: jest.fn() } as any,
      { get: jest.fn().mockReturnValue(10) } as any,
    );
  });

  it('sanitizes search input and uses parameterized ILIKE', async () => {
    // eslint-disable-next-line quotes
    const maliciousSearch = "a%_b\\ test' OR 1=1 --";

    await expect(
      service.findAll({
        search: maliciousSearch,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      }),
    ).resolves.toBeDefined();

    expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');

    // eslint-disable-next-line quotes
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "(user.email ILIKE :search ESCAPE '\\' OR user.firstName ILIKE :search ESCAPE '\\' OR user.lastName ILIKE :search ESCAPE '\\')", // eslint-disable-line quotes
      {
        // eslint-disable-next-line quotes
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

    userRepository.findOne = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password: currentHash,
      passwordHistory: [],
    });
    userRepository.save = jest.fn().mockResolvedValue(true);

    await expect(service.update('user-1', { password: 'CurrentPass1!' })).rejects.toThrow(
      /New password must be different from the current password/,
    );
  });

  it('rejects password reuse via history', async () => {
    const currentHash = await bcrypt.hash('CurrentPass1!', 10);
    const oldHash = await bcrypt.hash('OldPass1!', 10);

    userRepository.findOne = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password: currentHash,
      passwordHistory: [oldHash],
    });
    userRepository.save = jest.fn().mockResolvedValue(true);

    await expect(service.update('user-1', { password: 'OldPass1!' })).rejects.toThrow(
      /New password must not match your last 5 passwords/,
    );
  });

  it('updates password and appends current password to history', async () => {
    const currentHash = await bcrypt.hash('CurrentPass1!', 10);

    userRepository.findOne = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password: currentHash,
      passwordHistory: [],
    });
    userRepository.save = jest.fn().mockImplementation(async (user: any) => user);

    const result = await service.update('user-1', { password: 'NewPass1!' });

    expect(result.password).not.toBe('NewPass1!');
    expect(await bcrypt.compare('NewPass1!', result.password)).toBe(true);
    expect(result.passwordHistory).toEqual([currentHash]);
  });
});
