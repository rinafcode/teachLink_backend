import { Test, TestingModule } from '@nestjs/testing';
import { AuditQueryService } from './audit-query.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../audit-log.entity';

describe('AuditQueryService Pagination Limits', () => {
  let service: AuditQueryService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditQueryService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AuditQueryService>(AuditQueryService);
  });

  it('should enforce a hard maximum limit of 1000 for findAll', async () => {
    await service.findAll(0, 999999);
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1000,
      }),
    );
  });

  it('should enforce a hard maximum limit of 1000 for findByUser', async () => {
    await service.findByUser('user123', 0, 999999);
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1000,
      }),
    );
  });

  it('should apply a default 30-day time window if dates are not provided', async () => {
    await service.findAll(0, 10);
    const callArgs = mockRepo.find.mock.calls[0][0];
    const whereClause = callArgs.where.timestamp as any;

    // We expect a Between() operator
    expect(whereClause._type).toEqual('between');
    const [start, end] = whereClause._value;

    expect(end).toBeInstanceOf(Date);
    expect(start).toBeInstanceOf(Date);

    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});
