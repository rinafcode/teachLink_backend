import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

/**
 * Represents the moderation Event entity.
 */
@Entity()
@Index('IDX_moderation_event_status', ['status'])
@Index('IDX_moderation_event_timestamp', ['timestamp'])
export class ModerationEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column('text')
  content: string;

  @Column('float')
  score: number;

  @Column()
  status: string;

  @CreateDateColumn()
  timestamp: Date;
}
