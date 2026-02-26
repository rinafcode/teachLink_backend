import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class ReviewItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  content: string;

  @Column('float')
  safetyScore: number;

  @Column({ default: 'pending' })
  status: 'pending' | 'reviewed';

  @CreateDateColumn()
  createdAt: Date;
}
