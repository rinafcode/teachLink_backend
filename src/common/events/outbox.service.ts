import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OutboxEvent } from './outbox.entity';

/**
 * Write-side API for the transactional outbox (issue #1221).
 *
 * - `enqueue(manager, ...)` persists the event inside the caller's running
 *   transaction, making it atomic with the state change. Use this inside
 *   `dataSource.transaction(...)` callbacks.
 * - `enqueueStandalone(...)` persists the event in its own write, for
 *   producers that mutate state outside an explicit transaction. The row is
 *   durable immediately and delivered at-least-once by the relay, which still
 *   fixes the crash-loss failure mode of in-process-only emits.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
  ) {}

  /**
   * Enqueue an event atomically with the caller's transaction.
   *
   * If the transaction rolls back, the outbox row rolls back with it and no
   * consumer ever observes the event (no ghost side effects).
   */
  async enqueue(
    manager: EntityManager,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await manager.getRepository(OutboxEvent).save(
      this.outboxRepo.create({
        eventName,
        payload,
      }),
    );
  }

  /**
   * Enqueue an event outside a transaction (durable, at-least-once delivery).
   */
  async enqueueStandalone(eventName: string, payload: Record<string, unknown>): Promise<void> {
    await this.outboxRepo.save(
      this.outboxRepo.create({
        eventName,
        payload,
      }),
    );
  }

  /** Number of unpublished events still waiting for the relay (observability). */
  async countPending(): Promise<number> {
    return this.outboxRepo
      .createQueryBuilder('outbox')
      .where('outbox.published_at IS NULL')
      .getCount();
  }
}
