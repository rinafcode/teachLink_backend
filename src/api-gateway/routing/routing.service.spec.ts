import { Test, TestingModule } from '@nestjs/testing';
import { RoutingService } from './routing.service';
import { ServiceDiscoveryService } from '../../messaging/services/service-discovery.service';

describe('RoutingService', () => {
  let service: RoutingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        {
          provide: ServiceDiscoveryService,
          useValue: { loadBalance: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RoutingService>(RoutingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
}); 