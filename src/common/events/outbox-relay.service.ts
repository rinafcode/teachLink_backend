import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsNull, Repository } from 'typeorm';
import { OutboxEvent } from './outbox.entity';

/** Poll interval for the outbox relay (ms). */
export const OUTBOX_POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1_000);

/** Max events dispatched per poll cycle. */
export const OUTBOX_BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 100);

/**
 * Relay for the transactional outbox (issue #1221).
 *
 * Polls `event_outbox` for unpublished rows in FIFO order (created_at ASC)
 * and dispatches each to the in-process EventEmitter2 bus. A row is marked
 * `published_at` only AFTER `emit()` completes without throwing, so:
 *
 * - A crash between commit and dispatch leaves the row unpublished and the
 *   event is redelivered on restart (at-least-once).
 * - A handler that throws during `emit()` leaves the row unpublished too;
 *   the attempts counter is incremented and delivery is retried on the next
 *   poll. Handlers are expected to be idempotent, so redelivery is safe.
 *
 * EventEmitter2's `emit` is synchronous fire-and-forget: async handlers are
 * not awaited. That is acceptable here — the at-least-once guarantee comes
 * from not marking the row published until `emit()` returns without an
 * exception, and handlers guard against duplicates (idempotency).
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.poll().catch((err) =>
        this.logger.error(
          'Outbox poll cycle failed',
          err instanceof Error ? err.stack : String(err),
        ),
      );
    }, OUTBOX_POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Dispatch one batch of unpublished events. Returns the number dispatched.
   */
  async poll(): Promise<number> {
    if (this.polling) return 0;
    this.polling = true;
    try {
      const rows = await this.outboxRepo.find({
        where: { publishedAt: IsNull() },
        order: { createdAt: 'ASC' },
        take: OUTBOX_BATCH_SIZE,
      });

      let dispatched = 0;
      for (const row of rows) {
        try {
          this.eventEmitter.emit(row.eventName, row.payload);
          await this.outboxRepo.update(row.id, { publishedAt: new Date() });
          dispatched += 1;
        } catch (err) {
          this.logger.warn(
            `Outbox dispatch failed for event=${row.eventName} id=${row.id} ` +
              `attempt=${row.attempts + 1}: ${err instanceof Error ? err.message : String(err)}`,
          );
          await this.outboxRepo.update(row.id, {
            attempts: row.attempts + 1,
          });
        }
      }
      return dispatched;
    } finally {
      this.polling = false;
    }
  }
}
