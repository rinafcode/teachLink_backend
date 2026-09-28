import { User, UserRole, UserStatus } from './entities/user.entity';
import { UsersService } from './users.service';

const makeMockQueryBuilder = () => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  distinct: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
});

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepo: any;
  let mockQueryBuilder: ReturnType<typeof makeMockQueryBuilder>;

  beforeEach(() => {
    mockQueryBuilder = makeMockQueryBuilder();
    mockUserRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };
    service = new UsersService(mockUserRepo);
  });

  it('loads joined role fields and returns the user role', async () => {
    const users = [
      {
        id: 'user-1',
        firstName: 'Jane',
        lastName: 'Doe',
        username: 'jdoe',
        profilePicture: 'https://cdn.example.com/avatar.png',
        email: 'jane.doe@example.com',
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        roles: [{ id: 'role-1', name: UserRole.ADMIN }],
      } as User,
    ];

    mockQueryBuilder.getMany.mockResolvedValue(users);

    const results = await service.searchUsers('jane', UserRole.ADMIN, 2, 10);

    expect(mockUserRepo.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('user.roles', 'role');
    expect(mockQueryBuilder.select).toHaveBeenCalledWith(
      expect.arrayContaining(['role.id', 'role.name']),
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('role.name = :role', {
      role: UserRole.ADMIN,
    });
    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);

    expect(results).toEqual([
      {
        id: 'user-1',
        displayName: 'jdoe',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        role: UserRole.ADMIN,
        email: 'jane.doe@example.com',
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
      },
    ]);
  });

  it('passes a well-formed search query string to andWhere when q is provided', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.searchUsers('jane', undefined, 1, 20);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.username ILIKE :search)',
      { search: '%jane%' },
    );
  });
});
