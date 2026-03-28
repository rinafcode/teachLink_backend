import { UsersService } from './users.service';
import { UserRole, UserStatus } from './entities/user.entity';

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

    service = new UsersService(userRepository, cachingService, { emit: jest.fn() } as any);
  });

  it('sanitizes search input and uses parameterized ILIKE', async () => {
    const maliciousSearch = "a%_b\\ test' OR 1=1 --";

    await expect(
      service.findAll({
        search: maliciousSearch,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      }),
    ).resolves.toBeDefined();

    expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
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
});
