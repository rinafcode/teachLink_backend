import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, VersionColumn } from 'typeorm';

/**
 * Represents the review Item entity.
 */
@Entity()
export class ReviewItem {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column('text')
  content: string;

  @Column('float')
  safetyScore: number;

  @Column({ default: 'pending' })
  status: 'pending' | 'reviewed';

  @CreateDateColumn()
  createdAt: Date;
}
