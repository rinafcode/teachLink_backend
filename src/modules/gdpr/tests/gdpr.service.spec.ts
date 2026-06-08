import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GdprService } from '../gdpr.service';
import { UserConsent } from '../entities/user-consent.entity';

const mockUsersService = {
  findById: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockConsentRepository = {
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((dto) => ({ ...dto, id: 'consent-1' })),
  save: jest.fn((consent) => Promise.resolve(consent)),
};

describe('GdprService', () => {
  let service: GdprService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: 'UsersService', useValue: mockUsersService },
        { provide: 'AuditService', useValue: mockAuditService },
        { provide: getRepositoryToken(UserConsent), useValue: mockConsentRepository },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  it('exports user data', async () => {
    const result = await service.exportUserData('user-1');
    expect(result.profile).toBeDefined();
  });

  it('erases user data', async () => {
    const result = await service.eraseUserData('user-1');
    expect(result.success).toBe(true);
  });

  it('stores consent changes', async () => {
    const result = await service.updateConsent('user-1', {
      consentType: 'MARKETING',
      granted: true,
    });
    expect(result.granted).toBe(true);
  });
});
