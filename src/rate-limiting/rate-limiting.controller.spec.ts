import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitingController } from './rate-limiting.controller';
import { RateLimitingService } from './rate-limiting.service';
import { ThrottlingService } from './services/throttling.service';

describe('RateLimitingController', () => {
  let controller: RateLimitingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RateLimitingController],
      providers: [
        RateLimitingService,
        {
          provide: ThrottlingService,
          useValue: {
            checkLimit: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RateLimitingController>(RateLimitingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
