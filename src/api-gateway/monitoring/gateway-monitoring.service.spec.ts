import { Test, TestingModule } from '@nestjs/testing';
import { GatewayMonitoringService } from './gateway-monitoring.service';

describe('GatewayMonitoringService', () => {
  let service: GatewayMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GatewayMonitoringService],
    }).compile();

    service = module.get<GatewayMonitoringService>(GatewayMonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
}); 