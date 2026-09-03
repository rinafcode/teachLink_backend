import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Campaign } from './campaign.entity';
import { ABTestVariant } from './ab-test-variant.entity';
import { ABTestStatus } from '../enums/ab-test-status.enum';

/**
 * Represents the aBTest entity.
 */
@Entity('ab_tests')
export class ABTest {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Index('IDX_ab_tests_campaignId')
  @Column()
  campaignId: string;

  @OneToOne(() => Campaign)
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @ApiProperty()
  @Column()
  testField: string; // 'subject', 'template', 'sender', 'sendTime'

  @ApiProperty()
  @Column({ default: 'open_rate' })
  winnerCriteria: string; // 'open_rate', 'click_rate'

  @ApiProperty()
  @Column({ default: 20 })
  sampleSize: number; // Percentage of total recipients for test

  @ApiProperty({ enum: ABTestStatus })
  @Index('IDX_ab_tests_status')
  @Column({ type: 'enum', enum: ABTestStatus, default: ABTestStatus.DRAFT })
  status: ABTestStatus;

  @OneToMany(() => ABTestVariant, (variant) => variant.abTest, { cascade: true })
  variants: ABTestVariant[];

  @ApiProperty({ required: false })
  @Index('IDX_ab_tests_winnerId')
  @Column({ nullable: true })
  winnerId?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  startedAt?: Date;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  endedAt?: Date;

  @ApiProperty()
  @Index('IDX_ab_tests_createdAt')
  @CreateDateColumn()
  createdAt: Date;
}
