import { AuditLogService } from '../audit-log.service';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { ConfigService } from '@nestjs/config';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: Repository<AuditLog>;
  let configService: ConfigService;

  beforeEach(() => {
    // Mock repository and config service
    repo = {} as Repository<AuditLog>;
    configService = {
      get: jest.fn().mockReturnValue(365),
    } as any;
    service = new AuditLogService(repo as any, configService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
