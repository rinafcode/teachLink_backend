import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { GdprService } from '../gdpr.service';
import { UserConsent } from '../entities/user-consent.entity';
import { User } from '../../../users/entities/user.entity';
import { Enrollment } from '../../../courses/entities/enrollment.entity';
import { Payment } from '../../../payments/entities/payment.entity';
import { Notification } from '../../../notifications/entities/notification.entity';
import { SessionService } from '../../../session/session.service';

const mockUserRepository = {
  findOne: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
    password: '$2a$10$bcryptencryptedhashplaceholder',
    refreshToken: 'some-refresh-token-value',
    passwordHistory: ['$2a$10$oldhash1', '$2a$10$oldhash2'],
    totpSecret: 'supersecretotpvalue',
    token: 'active-session-token-or-verification-token',
    deletedAt: null,
  }),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockEnrollmentRepository = {
  find: jest
    .fn()
    .mockResolvedValue([
      { id: 'enrollment-1', userId: 'user-1', courseId: 'course-1', deletedAt: null },
    ]),
};

const mockPaymentRepository = {
  find: jest
    .fn()
    .mockResolvedValue([{ id: 'payment-1', userId: 'user-1', amount: 100, deletedAt: null }]),
};

const mockNotificationRepository = {
  find: jest
    .fn()
    .mockResolvedValue([
      { id: 'notification-1', userId: 'user-1', title: 'Test', deletedAt: null },
    ]),
};

const mockSessionService = {
  deleteAllSessionsForUser: jest.fn().mockResolvedValue(undefined),
};

const mockUsersService = {
  findById: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
    deletedAt: null,
  }),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockConsentRepository = {
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((dto) => ({ ...dto, id: 'consent-1' })),
  save: jest.fn((consent) => Promise.resolve(consent)),
  manager: {
    transaction: jest.fn(async (cb) => {
      const mockEntityManager = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      return cb(mockEntityManager);
    }),
  },
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
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
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Enrollment), useValue: mockEnrollmentRepository },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepository },
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
    mockUserRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.eraseUserData('missing-user')).rejects.toThrow(NotFoundException);
  });

  it('is idempotent: second erasure call succeeds even when user is already deleted', async () => {
    // First call succeeds normally
    await service.eraseUserData('user-1');
    // Second call: findById still returns something (soft-deleted row)
    await expect(service.eraseUserData('user-1')).resolves.toEqual({ success: true });
  });

  it('supports idempotent erasure on repeated calls', async () => {
    // Reset mock history
    mockUsersService.update.mockClear();
    mockAuditService.log.mockClear();

    // First call
    const result1 = await service.eraseUserData('user-1');
    expect(result1.success).toBe(true);
    expect(mockUsersService.update).toHaveBeenCalledTimes(1);
    expect(mockAuditService.log).toHaveBeenCalledWith('GDPR_ERASURE', 'user-1');

    // Simulate database state change by updating the mock return value to have deletedAt
    const originalFindOne = mockUserRepository.findOne;
    mockUserRepository.findOne = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: null,
      firstName: '[DELETED]',
      lastName: '[DELETED]',
      deletedAt: new Date(),
    });

    // Second call
    const result2 = await service.eraseUserData('user-1');
    expect(result2.success).toBe(true);

    // Verify the DB update and audit logs are called again (idempotent calls)
    expect(mockUsersService.update).toHaveBeenCalledTimes(2);
    expect(mockAuditService.log).toHaveBeenCalledTimes(2);

    // Restore original mock
    mockUserRepository.findOne = originalFindOne;
  });

  it('stores consent changes', async () => {
    const result = await service.updateConsent('user-1', {
      consentType: 'MARKETING',
      granted: true,
    });
    expect(result.granted).toBe(true);
  });
});
