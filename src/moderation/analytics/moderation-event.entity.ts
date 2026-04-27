import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, VersionColumn } from 'typeorm';

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
