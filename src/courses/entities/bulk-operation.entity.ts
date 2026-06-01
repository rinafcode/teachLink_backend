import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
  Check,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum BulkOperationType {
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
  PRICE_UPDATE = 'price_update',
  CATEGORY_UPDATE = 'category_update',
}

export enum BulkOperationStatus {
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  UNDONE = 'undone',
}

export interface CoursePreviousState {
  status?: string;
  price?: number;
  category?: string | null;
}

export interface BulkCourseSnapshot {
  courseId: string;
  previous: CoursePreviousState;
  applied: boolean;
  error?: string;
}

export interface BulkOperationPayload {
  price?: number;
  category?: string;
  status?: string;
}

@Entity('course_bulk_operations')
@Check(`"totalCount" >= 0`)
@Check(`"successCount" >= 0`)
@Check(`"failureCount" >= 0`)
export class BulkOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * User who initiated the bulk operation.
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy?: User;

  @Index()
  @Column({
    name: 'initiated_by_id',
    type: 'uuid',
    nullable: true,
  })
  initiatedBy?: string;

  /**
   * User who executed the undo operation.
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'undone_by_id' })
  undoneBy?: User;

  @Index()
  @Column({
    name: 'undone_by_id',
    type: 'uuid',
    nullable: true,
  })
  undoneById?: string;

  @Index()
  @Column({
    type: 'enum',
    enum: BulkOperationType,
  })
  type: BulkOperationType;

  @Index()
  @Column({
    type: 'enum',
    enum: BulkOperationStatus,
    default: BulkOperationStatus.COMPLETED,
  })
  status: BulkOperationStatus;

  /**
   * Payload applied during the operation.
   * Example:
   * { price: 49.99 }
   */
  @Column({ type: 'jsonb' })
  payload: BulkOperationPayload;

  /**
   * Original state of every affected course.
   */
  @Column({
    type: 'jsonb',
    default: () => "'[]'",
  })
  snapshots: BulkCourseSnapshot[];

  @Column({
    type: 'int',
    default: 0,
  })
  totalCount: number;

  @Column({
    type: 'int',
    default: 0,
  })
  successCount: number;

  @Column({
    type: 'int',
    default: 0,
  })
  failureCount: number;

  /**
   * Optional reason supplied by the instructor.
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  reason?: string;

  /**
   * Internal audit notes.
   */
  @Column({
    type: 'text',
    nullable: true,
  })
  notes?: string;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  undoneAt?: Date;

  /**
   * Optimistic locking to prevent concurrent updates.
   */
  @VersionColumn()
  version: number;

  @Index()
  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  /**
   * Derived helpers
   */
  get isSuccessful(): boolean {
    return (
      this.status === BulkOperationStatus.COMPLETED &&
      this.failureCount === 0
    );
  }

  get isPartiallySuccessful(): boolean {
    return this.status === BulkOperationStatus.PARTIAL;
  }

  get canUndo(): boolean {
    return (
      this.status !== BulkOperationStatus.UNDONE &&
      this.successCount > 0
    );
  }

  get successRate(): number {
    if (!this.totalCount) return 0;
    return (this.successCount / this.totalCount) * 100;
  }
}