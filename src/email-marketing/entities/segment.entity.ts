import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  VersionColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { SegmentRule } from './segment-rule.entity';

/**
 * Represents the segment entity.
 */
@Entity('segments')
export class Segment {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ApiProperty()
  @Index('IDX_segments_name')
  @Column()
  name: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty()
  @Index('IDX_segments_isDynamic_createdAt', ['isDynamic', 'createdAt'])
  @Column({ default: true })
  isDynamic: boolean;

  @OneToMany(() => SegmentRule, (rule) => rule.segment, { cascade: true })
  rules: SegmentRule[];

  @ApiProperty({ type: [String] })
  @Column('simple-array', { nullable: true })
  staticMemberIds?: string[];

  @ApiProperty()
  memberCount?: number; // Calculated field

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @Index('IDX_segments_deletedAt', ['deletedAt'], {
    where: '"deletedAt" IS NULL',
  })
  @DeleteDateColumn()
  deletedAt?: Date;
}
