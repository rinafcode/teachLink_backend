import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEnforcementService } from './policy-enforcement.service';
import { RateLimitingService } from '../../rate-limiting/rate-limiting.service';

describe('PolicyEnforcementService', () => {
  let service: PolicyEnforcementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEnforcementService,
        {
          provide: RateLimitingService,
          useValue: { isAllowed: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PolicyEnforcementService>(PolicyEnforcementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
}); 