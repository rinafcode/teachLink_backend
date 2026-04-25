import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, } from 'typeorm';
export enum WebhookStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed',
    DEAD_LETTER = 'dead_letter'
}
export enum WebhookProvider {
    STRIPE = 'stripe',
    PAYPAL = 'paypal'
}
@Entity('webhook_retries')
@Index(['provider', 'externalEventId'], { unique: true })
@Index(['status', 'nextRetryTime'])
@Index(['createdAt'])
export class WebhookRetry {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ type: 'enum', enum: WebhookProvider })
    provider: WebhookProvider;
    @Column()
    externalEventId: string;
    @Column({ type: 'enum', enum: WebhookStatus, default: WebhookStatus.PENDING })
    status: WebhookStatus;
    @Column({ type: 'jsonb', nullable: true })
    payload: Record<string, unknown>;
    @Column({ type: 'text', nullable: true })
    signature: string;
    @Column({ type: 'int', default: 0 })
    retryCount: number;
    @Column({ type: 'int', default: 3 })
    maxRetries: number;
    @Column({ type: 'timestamp', nullable: true })
    nextRetryTime: Date;
    @Column({ type: 'text', nullable: true })
    lastError: string;
    @Column({ type: 'jsonb', nullable: true })
    errorDetails: Record<string, unknown>;
    @CreateDateColumn()
    createdAt: Date;
    @UpdateDateColumn()
    updatedAt: Date;
    @Column({ type: 'timestamp', nullable: true })
    processedAt: Date;
    @Column({ type: 'jsonb', nullable: true })
    headers: Record<string, string>;
}
