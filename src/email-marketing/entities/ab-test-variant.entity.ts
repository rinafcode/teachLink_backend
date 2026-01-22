import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { ABTest } from './ab-test.entity';

@Entity('ab_test_variants')
export class ABTestVariant {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty()
    @Column()
    abTestId: string;

    @ManyToOne(() => ABTest, (abTest) => abTest.variants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'abTestId' })
    abTest: ABTest;

    @ApiProperty()
    @Column()
    name: string; // e.g., 'Variant A', 'Variant B'

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    subject?: string;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    templateId?: string;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    senderName?: string;

    @ApiProperty()
    @Column({ default: 50 })
    weight: number; // Percentage of traffic

    @ApiProperty()
    @Column({ default: 0 })
    recipientCount: number;
}
