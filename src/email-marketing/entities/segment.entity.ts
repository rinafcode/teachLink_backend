import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  VersionColumn,
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
  @Column()
  name: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty()
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

  @DeleteDateColumn()
  deletedAt?: Date;
}
