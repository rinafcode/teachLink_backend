import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Campaign } from './campaign.entity';
import { ABTestVariant } from './ab-test-variant.entity';
import { ABTestStatus } from '../enums/ab-test-status.enum';

@Entity('ab_tests')
export class ABTest {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty()
    @Column()
    name: string;

    @ApiProperty()
    @Column()
    campaignId: string;

    @OneToOne(() => Campaign)
    @JoinColumn({ name: 'campaignId' })
    campaign: Campaign;

    @ApiProperty()
    @Column()
    testField: string; // 'subject', 'template', 'sender', 'sendTime'

    @ApiProperty()
    @Column({ default: 'open_rate' })
    winnerCriteria: string; // 'open_rate', 'click_rate'

    @ApiProperty()
    @Column({ default: 20 })
    sampleSize: number; // Percentage of total recipients for test

    @ApiProperty({ enum: ABTestStatus })
    @Column({ type: 'enum', enum: ABTestStatus, default: ABTestStatus.DRAFT })
    status: ABTestStatus;

    @OneToMany(() => ABTestVariant, (variant) => variant.abTest, { cascade: true })
    variants: ABTestVariant[];

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    winnerId?: string;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    startedAt?: Date;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    endedAt?: Date;

    @ApiProperty()
    @CreateDateColumn()
    createdAt: Date;
}
