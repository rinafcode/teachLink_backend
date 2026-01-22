import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { SegmentRule } from './segment-rule.entity';

@Entity('segments')
export class Segment {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

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
}
