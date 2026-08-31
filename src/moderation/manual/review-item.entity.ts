import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, VersionColumn, Index } from 'typeorm';

/**
 * Represents the review Item entity.
 */
@Entity()
@Index('IDX_review_items_status', ['status'])
@Index('IDX_review_items_safetyScore_createdAt', ['safetyScore', 'createdAt'])
@Index('IDX_review_items_sourceType', ['sourceType'])
@Index('IDX_review_items_sourceId', ['sourceId'])
@Index('IDX_review_items_reportId', ['reportId'])
export class ReviewItem {
  @PrimaryGeneratedColumn()
  id: number;

  @VersionColumn()
  version: number;

  @Column('text')
  content: string;

  @Column('float')
  safetyScore: number;

  @Column({ nullable: true })
  sourceType?: string;

  @Column({ nullable: true })
  sourceId?: string;

  @Column({ nullable: true })
  reportId?: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'reviewed';

  @CreateDateColumn()
  createdAt: Date;
}
