import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  refundMethod: string; // 'original_method', 'store_credit', etc.

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.PENDING })
  status: RefundStatus;

  @Column({ type: 'varchar', nullable: true })
  providerRefundId: string; // External refund ID from payment provider

  @Column({ type: 'varchar', nullable: true, unique: true })
  @Index()
  idempotencyKey: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Payment, (payment) => payment.id)
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payment_id' })
  paymentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
