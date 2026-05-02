import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EmailEventType } from '../enums/email-event-type.enum';

/**
 * Represents the email Event entity.
 */
@Entity('email_events')
@Index(['campaignId', 'eventType'])
@Index(['recipientId', 'eventType'])
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

  @ApiProperty({ required: false })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @ApiProperty()
  @CreateDateColumn()
  occurredAt: Date;
}
