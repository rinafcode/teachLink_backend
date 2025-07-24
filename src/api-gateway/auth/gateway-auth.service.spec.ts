import { Test, TestingModule } from '@nestjs/testing';
import { GatewayAuthService } from './gateway-auth.service';
import { JwtService } from '@nestjs/jwt';

describe('GatewayAuthService', () => {
  let service: GatewayAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayAuthService,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<GatewayAuthService>(GatewayAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
}); 