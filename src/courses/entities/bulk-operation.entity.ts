import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Type of bulk operation an instructor can perform on their courses. */
export enum BulkOperationType {
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
  PRICE_UPDATE = 'price_update',
  CATEGORY_UPDATE = 'category_update',
}

/** Lifecycle of a bulk operation record. */
export enum BulkOperationStatus {
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  UNDONE = 'undone',
}

/**
 * One snapshot per affected course captured before a bulk operation
 * is applied. Used to deterministically undo the operation later.
 */
export interface BulkCourseSnapshot {
  /** Course ID that was modified. */
  courseId: string;
  /** Field-level previous values (only fields the op touched). */
  previous: {
    status?: string;
    price?: number;
    category?: string | null;
  };
  /** Whether this course was applied successfully in the bulk run. */
  applied: boolean;
  /** Optional error message if this course failed. */
  error?: string;
}

/**
 * Records a bulk operation performed by an instructor so it can be
 * audited and undone. The `snapshots` JSON column stores the
 * pre-operation state of every affected course.
 */
@Entity('course_bulk_operations')
export class BulkOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The instructor (or admin) who triggered the operation. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy?: User;

  @Column({ name: 'initiated_by_id', type: 'uuid', nullable: true })
  @Index()
  initiatedById?: string;

  @Column({ type: 'enum', enum: BulkOperationType })
  @Index()
  type: BulkOperationType;

  @Column({
    type: 'enum',
    enum: BulkOperationStatus,
    default: BulkOperationStatus.COMPLETED,
  })
  status: BulkOperationStatus;

  /** The payload that was applied (e.g. `{ price: 49.99 }`). */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Per-course snapshot used for undo. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  snapshots: BulkCourseSnapshot[];

  /** Total number of courses requested in the bulk action. */
  @Column({ type: 'int', default: 0 })
  totalCount: number;

  /** Number of courses that were applied successfully. */
  @Column({ type: 'int', default: 0 })
  successCount: number;

  /** Number of courses that failed during the bulk run. */
  @Column({ type: 'int', default: 0 })
  failureCount: number;

  /** Timestamp at which an undo was successfully performed. */
  @Column({ type: 'timestamptz', nullable: true })
  undoneAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
