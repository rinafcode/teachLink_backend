import { UserRole, UserStatus } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UserSearchResult, UsersService } from './users.service';

const makeUser = (overrides: Partial<UserSearchResult> = {}) =>
  ({
    id: 'user-1',
    displayName: 'Jane Doe',
    avatarUrl: 'https://cdn.example.com/avatar.png',
    role: UserRole.STUDENT,
    ...overrides,
  }) as UserSearchResult;

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Partial<UsersService>;

  beforeEach(() => {
    usersService = {
      searchUsers: jest.fn(),
    };
    controller = new UsersController(usersService as UsersService);
  });

  it('returns public fields and omits email for non-admin users', async () => {
    (usersService.searchUsers as jest.Mock).mockResolvedValue([makeUser()]);

    const response = await controller.search(
      { user: { role: UserRole.STUDENT } },
      undefined,
      undefined,
      '1',
      '20',
    );

    expect(Array.isArray(response)).toBe(true);
    expect(response).toEqual([
      {
        id: 'user-1',
        displayName: 'Jane Doe',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        role: UserRole.STUDENT,
      },
    ]);
    expect((response as any)[0].email).toBeUndefined();
    expect((response as any)[0].refreshToken).toBeUndefined();
    expect((response as any)[0].passwordHistory).toBeUndefined();
  });

  it('returns admin fields for admin users', async () => {
    (usersService.searchUsers as jest.Mock).mockResolvedValue([
      makeUser({
        role: UserRole.ADMIN,
        email: 'admin@example.com',
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
      }),
    ]);

    const response = await controller.search(
      { user: { role: UserRole.ADMIN } },
      undefined,
      undefined,
      '1',
      '20',
    );

    expect(response).toEqual([
      {
        id: 'user-1',
        displayName: 'Jane Doe',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        role: UserRole.ADMIN,
        email: 'admin@example.com',
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
      },
    ]);
  });
});
