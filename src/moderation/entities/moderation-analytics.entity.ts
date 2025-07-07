import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('moderation_analytics')
export class ModerationAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  date: Date;

  @Column()
  moderatorId: string;

  @Column({ default: 0 })
  totalReviews: number;

  @Column({ default: 0 })
  approvedContent: number;

  @Column({ default: 0 })
  rejectedContent: number;

  @Column({ default: 0 })
  escalatedContent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageReviewTime: number; // in minutes

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  accuracy: number; // percentage of correct decisions

  @Column({ type: 'jsonb', nullable: true })
  categoryBreakdown: Record<string, number>;

  @Column({ type: 'jsonb', nullable: true })
  actionBreakdown: Record<string, number>;

  @Column({ type: 'jsonb', nullable: true })
  performanceMetrics: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  qualityMetrics: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 