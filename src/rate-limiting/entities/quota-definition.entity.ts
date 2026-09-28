import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserTier } from '../rate-limiting.constants';

/**
 * Stores configurable quota rules.
 * One row per tier (or per-user override when userId is set).
 * Admin API can update these without a deployment.
 */
@Entity('quota_definitions')
@Index(['tier', 'isActive'])
export class QuotaDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: UserTier, nullable: true })
  tier: UserTier | null;

  /** When set, this row is a per-user override and takes precedence over the tier row. */
  @Column({ nullable: true })
  @Index()
  userId: string | null;

  @Column({ type: 'int' })
  requestsPerMinute: number;

  @Column({ type: 'int' })
  requestsPerHour: number;

  @Column({ type: 'int' })
  requestsPerDay: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
