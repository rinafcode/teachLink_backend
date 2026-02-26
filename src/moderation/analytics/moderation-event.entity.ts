import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class ModerationEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  content: string;

  @Column('float')
  score: number;

  @Column()
  status: string;

  @CreateDateColumn()
  timestamp: Date;
}
