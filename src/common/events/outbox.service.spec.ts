import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox.entity';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let service: OutboxService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manager: any;
  let managerRepo: { save: jest.Mock };

  beforeEach(async () => {
    managerRepo = { save: jest.fn().mockResolvedValue({ id: 'evt-1' }) };
    manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo),
    };
    repo = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxService, { provide: getRepositoryToken(OutboxEvent), useValue: repo }],
    }).compile();

    service = module.get(OutboxService);
  });

  it('enqueue persists the event through the caller transaction manager', async () => {
    await service.enqueue(manager, 'cache.course.created', { id: 'c1' });

    expect(manager.getRepository).toHaveBeenCalledWith(OutboxEvent);
    expect(managerRepo.save).toHaveBeenCalledWith({
      eventName: 'cache.course.created',
      payload: { id: 'c1' },
    });
  });

  it('enqueueStandalone persists the event via its own repository', async () => {
    await service.enqueueStandalone('payment.completed', { paymentId: 'p1' });

    expect(repo.save).toHaveBeenCalledWith({
      eventName: 'payment.completed',
      payload: { paymentId: 'p1' },
    });
  });

  it('countPending counts rows with a null publishedAt', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
    };
    repo.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.countPending()).resolves.toBe(3);
    expect(queryBuilder.where).toHaveBeenCalledWith('outbox.published_at IS NULL');
  });
});
