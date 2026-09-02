import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

/**
 * Represents a consumer's CCPA privacy preferences.
 * Tracks opt-outs for data sale, marketing, and other CCPA rights.
 */
@Entity('consumer_privacy_preferences')
@Index('IDX_consumer_privacy_preferences_tenant_user', ['tenantId', 'userId'], { unique: true })
export class ConsumerPrivacyPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ nullable: true })
  @Index('IDX_consumer_privacy_preferences_tenant_id')
  tenantId?: string;

  @Column()
  @Index('IDX_consumer_privacy_preferences_user_id')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ default: false })
  @Index('IDX_consumer_privacy_preferences_do_not_sell')
  doNotSellMyPersonalInformation: boolean;

  @Column({ default: false })
  optOutOfDataSharing: boolean;

  @Column({ default: false })
  optOutOfMarketing: boolean;

  @Column({ default: false })
  limitUseOfSensitivePersonalInformation: boolean;

  @Column({ type: 'jsonb', nullable: true })
  dataCategoryPreferences: Record<string, boolean>;

  @Column({ type: 'jsonb', nullable: true })
  purposePreferences: Record<string, boolean>;

  @Column({ type: 'timestamp', nullable: true })
  @Index('IDX_consumer_privacy_preferences_last_request_date')
  lastCcpRequestDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'varchar', nullable: true })
  source: string;

  @Column({ default: false })
  identityVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  verificationMethod: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
