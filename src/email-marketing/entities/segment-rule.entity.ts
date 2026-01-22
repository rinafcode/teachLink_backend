import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Segment } from './segment.entity';
import { SegmentRuleOperator } from '../enums/segment-rule-operator.enum';
import { SegmentRuleField } from '../enums/segment-rule-field.enum';

@Entity('segment_rules')
export class SegmentRule {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

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
}
