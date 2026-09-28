import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Segment } from './segment.entity';
import { SegmentRuleOperator } from '../enums/segment-rule-operator.enum';
import { SegmentRuleField } from '../enums/segment-rule-field.enum';

/**
 * Represents the segment Rule entity.
 *
 * Index strategy:
 *  - IDX_segment_rules_segmentId          — covers the FK lookup and all
 *    "load rules for a segment" queries.
 *  - IDX_segment_rules_segmentId_order    — composite index that satisfies
 *    the common "load rules for segment ordered by position" path without a
 *    separate sort step.
 *  - IDX_segment_rules_deletedAt          — partial index (WHERE deletedAt IS NULL)
 *    so soft-delete filtering stays efficient as the table grows.
 */
@Index('IDX_segment_rules_segmentId', ['segmentId'])
@Index('IDX_segment_rules_segmentId_order', ['segmentId', 'order'])
@Index('IDX_segment_rules_deletedAt', ['deletedAt'], {
  where: '"deletedAt" IS NULL',
})
@Entity('segment_rules')
export class SegmentRule {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ApiProperty()
  @Column()
  segmentId: string;

  @ManyToOne(() => Segment, (segment) => segment.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'segmentId' })
  segment: Segment;

  @ApiProperty({ enum: SegmentRuleField })
  @Column({ type: 'enum', enum: SegmentRuleField })
  field: SegmentRuleField;

  @ApiProperty({ enum: SegmentRuleOperator })
  @Column({ type: 'enum', enum: SegmentRuleOperator })
  operator: SegmentRuleOperator;

  @ApiProperty()
  @Column({ type: 'jsonb' })
  value: any;

  @ApiProperty()
  @Column({ default: 0 })
  order: number;

  @ApiProperty({ default: 'AND' })
  @Column({ default: 'AND' })
  logicalOperator: 'AND' | 'OR';

  @DeleteDateColumn()
  deletedAt?: Date;
}
