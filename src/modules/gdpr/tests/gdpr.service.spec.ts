import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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

describe('GdprService', () => {
  let service: GdprService;

  beforeEach(async () => {
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
        { provide: 'AuditService', useValue: mockAuditService },
        { provide: 'UsersService', useValue: {} },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  it('exports user data and excludes sensitive credential fields', async () => {
    const result = await service.exportUserData('user-1');
    expect(result.profile).toBeDefined();

    // Check that sensitive fields are explicitly excluded
    expect((result.profile as any).password).toBeUndefined();
    expect((result.profile as any).refreshToken).toBeUndefined();
    expect((result.profile as any).passwordHistory).toBeUndefined();
    expect((result.profile as any).totpSecret).toBeUndefined();
    expect((result.profile as any).token).toBeUndefined();

    // Check that PII fields are preserved
    expect((result.profile as any).id).toBe('user-1');
    expect((result.profile as any).email).toBe('test@test.com');
    expect((result.profile as any).firstName).toBe('John');
    expect((result.profile as any).lastName).toBe('Doe');
  });

  it('includes soft-deleted records in GDPR export', async () => {
    const deletedDate = new Date('2024-01-01');
    mockUserRepository.findOne.mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@test.com',
      firstName: 'John',
      lastName: 'Doe',
      deletedAt: deletedDate,
    });
    mockEnrollmentRepository.find.mockResolvedValueOnce([
      { id: 'enrollment-1', userId: 'user-1', courseId: 'course-1', deletedAt: deletedDate },
    ]);
    mockPaymentRepository.find.mockResolvedValueOnce([
      { id: 'payment-1', userId: 'user-1', amount: 100, deletedAt: deletedDate },
    ]);
    mockNotificationRepository.find.mockResolvedValueOnce([
      { id: 'notification-1', userId: 'user-1', title: 'Test', deletedAt: deletedDate },
    ]);

    const result = await service.exportUserData('user-1');

    // Verify user profile includes _deletedAt
    expect(result.profile._deletedAt).toEqual(deletedDate);

    // Verify enrollments include _deletedAt
    expect(result.enrollments).toHaveLength(1);
    expect((result.enrollments[0] as any)._deletedAt).toEqual(deletedDate);

    // Verify payments include _deletedAt
    expect(result.payments).toHaveLength(1);
    expect((result.payments[0] as any)._deletedAt).toEqual(deletedDate);

    // Verify notifications include _deletedAt
    expect(result.notifications).toHaveLength(1);
    expect((result.notifications[0] as any)._deletedAt).toEqual(deletedDate);
  });

  it('erases user data and invalidates sessions', async () => {
    const result = await service.eraseUserData('user-1');

    expect(result.success).toBe(true);
    expect(mockSessionService.deleteAllSessionsForUser).toHaveBeenCalledWith('user-1');
    expect(mockUsersService.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        email: null,
        firstName: '[DELETED]',
        lastName: '[DELETED]',
        phone: null,
        address: null,
        deletedAt: expect.any(Date),
        refreshToken: null,
      }),
    );
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
    const originalFindById = mockUsersService.findById;
    mockUsersService.findById = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: null,
      firstName: '[DELETED]',
      lastName: '[DELETED]',
      deletedAt: new Date(),
    });

    // Second call
    const result2 = await service.eraseUserData('user-1');
    expect(result2.success).toBe(true);
    expect(result2.alreadyErased).toBe(true);

    // Verify no extra DB updates or audit logs were created
    expect(mockUsersService.update).toHaveBeenCalledTimes(1);
    expect(mockAuditService.log).toHaveBeenCalledTimes(1);

    // Restore original mock
    mockUsersService.findById = originalFindById;
  });

  it('stores consent changes', async () => {
    const result = await service.updateConsent('user-1', {
      consentType: 'MARKETING',
      granted: true,
    });
    expect(result.granted).toBe(true);
  });
});
