import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Transactional outbox for domain events (issue #1221).
 *
 * Producers persist an event row in the SAME transaction as the state change
 * that produced it, so no consumer ever observes an event for a write that
 * rolled back. `OutboxRelayService` polls unpublished rows after commit and
 * dispatches them to the in-process EventEmitter2 bus, marking them published
 * only after dispatch succeeds. Delivery is at-least-once; consumers must be
 * idempotent under redelivery.
 */
@Entity('event_outbox')
@Index(['publishedAt', 'createdAt'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Event name dispatched to EventEmitter2 (e.g. `cache.course.created`). */
  @Column({ type: 'varchar', length: 255 })
  eventName: string;

  /** Serializable event payload forwarded verbatim to handlers. */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** When the event was enqueued (used by the relay's FIFO ordering). */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /** Set once the relay has dispatched the event; `null` while pending. */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /** Number of dispatch attempts so far (for observability/backoff). */
  @Column({ type: 'int', default: 0 })
  attempts: number;
}
