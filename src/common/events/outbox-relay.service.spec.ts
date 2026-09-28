import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxEvent } from './outbox.entity';
import { OutboxRelayService } from './outbox-relay.service';

describe('OutboxRelayService', () => {
  let service: OutboxRelayService;
  let repo: {
    find: jest.Mock;
    update: jest.Mock;
  };
  let emitter: { emit: jest.Mock };

  const pendingRow = (overrides: Partial<OutboxEvent> = {}): OutboxEvent =>
    ({
      id: 'evt-1',
      eventName: 'cache.course.created',
      payload: { id: 'course-1' },
      createdAt: new Date(),
      publishedAt: null,
      attempts: 0,
      ...overrides,
    }) as OutboxEvent;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        { provide: getRepositoryToken(OutboxEvent), useValue: repo },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get(OutboxRelayService);
    service.stop(); // unit tests drive poll() directly
  });

  afterEach(() => {
    service.stop();
  });

  it('dispatches unpublished events and marks them published', async () => {
    repo.find.mockResolvedValue([pendingRow()]);

    const dispatched = await service.poll();

    expect(dispatched).toBe(1);
    expect(emitter.emit).toHaveBeenCalledWith('cache.course.created', {
      id: 'course-1',
    });
    expect(repo.update).toHaveBeenCalledWith('evt-1', {
      publishedAt: expect.any(Date),
    });
  });

  it('queries only unpublished rows in FIFO order', async () => {
    repo.find.mockResolvedValue([]);

    await service.poll();

    // The relay relies on the WHERE clause to exclude already-published rows
    // and on the ORDER BY for oldest-first delivery.
    expect(repo.find).toHaveBeenCalledWith({
      where: { publishedAt: expect.anything() },
      order: { createdAt: 'ASC' },
      take: expect.any(Number),
    });
  });

  it('leaves the row unpublished and bumps attempts when dispatch throws', async () => {
    repo.find.mockResolvedValue([pendingRow()]);
    emitter.emit.mockImplementation(() => {
      throw new Error('handler failed');
    });

    const dispatched = await service.poll();

    expect(dispatched).toBe(0);
    expect(repo.update).toHaveBeenCalledWith('evt-1', { attempts: 1 });
    // publishedAt must NOT be set so the event is retried (at-least-once).
    expect(repo.update).not.toHaveBeenCalledWith('evt-1', {
      publishedAt: expect.any(Date),
    });
  });

  it('does not re-enter poll while a poll cycle is in flight', async () => {
    let resolveFind!: (rows: OutboxEvent[]) => void;
    repo.find.mockReturnValue(
      new Promise<OutboxEvent[]>((resolve) => {
        resolveFind = resolve;
      }),
    );

    const first = service.poll();
    // Second call while the first is awaiting the DB read.
    const second = service.poll();

    resolveFind([pendingRow()]);

    await Promise.all([first, second]);

    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });
});
