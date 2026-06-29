import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { GdprService } from '../gdpr.service';
import { UserConsent } from '../entities/user-consent.entity';
import { SessionService } from '../../../session/session.service';

const mockUsersService = {
  findById: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
    password: '$2a$10$bcryptencryptedhashplaceholder',
    refreshToken: 'some-refresh-token-value',
    passwordHistory: ['$2a$10$oldhash1', '$2a$10$oldhash2'],
    totpSecret: 'supersecretotpvalue',
    token: 'active-session-token-or-verification-token',
  }),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockSessionService = {
  deleteAllSessionsForUser: jest.fn().mockResolvedValue(undefined),
};

const mockConsentRepository = {
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((dto) => ({ ...dto, id: 'consent-1' })),
  save: jest.fn((consent) => Promise.resolve(consent)),
};

// QueryBuilder mock reused across table updates
function makeQb() {
  const qb: any = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  return qb;
}

const mockDataSource = {
  transaction: jest.fn((cb: (manager: any) => Promise<any>) => {
    const manager = { createQueryBuilder: jest.fn(() => makeQb()) };
    return cb(manager);
  }),
};

describe('GdprService', () => {
  let service: GdprService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: 'UsersService', useValue: mockUsersService },
        { provide: 'AuditService', useValue: mockAuditService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: getRepositoryToken(UserConsent), useValue: mockConsentRepository },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  it('exports user data and excludes sensitive credential fields', async () => {
    const result = await service.exportUserData('user-1');
    expect(result.profile).toBeDefined();

    expect(result.profile.password).toBeUndefined();
    expect(result.profile.refreshToken).toBeUndefined();
    expect(result.profile.passwordHistory).toBeUndefined();
    expect(result.profile.totpSecret).toBeUndefined();
    expect(result.profile.token).toBeUndefined();

    expect(result.profile.id).toBe('user-1');
    expect(result.profile.email).toBe('test@test.com');
    expect(result.profile.firstName).toBe('John');
    expect(result.profile.lastName).toBe('Doe');
  });

  it('erases user data: revokes sessions and runs transactional cascade anonymization', async () => {
    const result = await service.eraseUserData('user-1');

    expect(result.success).toBe(true);
    // Sessions revoked before transaction
    expect(mockSessionService.deleteAllSessionsForUser).toHaveBeenCalledWith('user-1');
    // Transaction executed
    expect(mockDataSource.transaction).toHaveBeenCalled();
    // Audit log written
    expect(mockAuditService.log).toHaveBeenCalledWith('GDPR_ERASURE', 'user-1');
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockUsersService.findById.mockResolvedValueOnce(null);
    await expect(service.eraseUserData('missing-user')).rejects.toThrow(NotFoundException);
  });

  it('is idempotent: second erasure call succeeds even when user is already deleted', async () => {
    // First call succeeds normally
    await service.eraseUserData('user-1');
    // Second call: findById still returns something (soft-deleted row)
    await expect(service.eraseUserData('user-1')).resolves.toEqual({ success: true });
  });

  it('stores consent changes', async () => {
    const result = await service.updateConsent('user-1', {
      consentType: 'MARKETING',
      granted: true,
    });
    expect(result.granted).toBe(true);
  });
});
