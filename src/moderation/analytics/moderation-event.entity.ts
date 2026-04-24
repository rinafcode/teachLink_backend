import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, VersionColumn } from 'typeorm';

/**
 * Represents the moderation Event entity.
 */
@Entity()
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
