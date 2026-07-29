import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailEventType } from '../enums/email-event-type.enum';

/**
 * Represents the email Event entity.
 */
@Entity('email_events')
@Index(['campaignId', 'eventType'])
@Index(['recipientId', 'eventType'])
@Index(['workflowId', 'eventType'])
export class EmailEvent {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ApiProperty()
  @Column()
  campaignId: string;

  @ApiProperty()
  @Column()
  recipientId: string;

  @ApiProperty({ enum: EmailEventType })
  @Column({ type: 'enum', enum: EmailEventType })
  eventType: EmailEventType;

  @ApiPropertyOptional()
  @Column({ nullable: true })
  workflowId?: string;

  @ApiPropertyOptional()
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  bounceReason?: string;

  @Column({ nullable: true })
  complaintType?: string;

  @Column({ type: 'int', nullable: true })
  reputationScore?: number;
  @ApiProperty()
  @CreateDateColumn()
  occurredAt: Date;
}
