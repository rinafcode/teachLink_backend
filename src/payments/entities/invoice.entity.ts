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
  DeleteDateColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { User } from '../../users/entities/user.entity';

export enum InvoiceStatus {
  PENDING = 'pending',
  SENT = 'sent',
  PAID = 'paid',
  VOID = 'void',
  REFUNDED = 'refunded',
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
}

/**
 * Represents the invoice entity.
 */
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  /**
   * Invoice number generated from PostgreSQL sequence.
   * Format: INV-<6-digit-zero-padded-sequence-value>
   * Example: INV-000001, INV-000042
   *
   * Uniqueness is enforced at the database level via unique constraint
   * (not application-level locking). This ensures no collisions under concurrent
   * invoice generation (e.g., parallel payment webhooks).
   */
  @Column({ unique: true })
  @Index()
  invoiceNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  /**
   * Applicable tax rate as a decimal fraction (e.g. `0.2` for 20%).
   * Null when no jurisdiction was resolved for the invoice.
   */
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  taxRate: number | null;

  /**
   * Jurisdiction the tax rate was resolved from (ISO 3166-1 alpha-2 code or
   * country name). Kept for audit purposes.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  taxJurisdiction: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'jsonb' })
  items: InvoiceItem[];

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  @Index()
  status: InvoiceStatus;

  @Column({ type: 'timestamp' })
  issuedDate: Date;

  @Column({ nullable: true })
  fileUrl: string;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payment_id' })
  @Index()
  paymentId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
