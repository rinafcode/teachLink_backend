import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SafetyCategory {
  VIOLENCE = 'violence',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  SEXUAL_CONTENT = 'sexual_content',
  SPAM = 'spam',
  MISINFORMATION = 'misinformation',
  COPYRIGHT = 'copyright',
  PRIVACY = 'privacy',
}

@Entity('safety_scores')
@Index(['contentId', 'createdAt'])
export class SafetyScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  contentId: string;

  @Column()
  contentType: string;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  overallScore: number; // 0.00 to 1.00, where 1.00 is safest

  @Column({ type: 'jsonb' })
  categoryScores: Record<SafetyCategory, number>;

  @Column({ type: 'jsonb', nullable: true })
  flaggedCategories: SafetyCategory[];

  @Column({ type: 'jsonb', nullable: true })
  aiAnalysis: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  humanReview: Record<string, any>;

  @Column({ default: false })
  requiresManualReview: boolean;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 