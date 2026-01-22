import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Campaign } from './campaign.entity';
import { RecipientStatus } from '../enums/recipient-status.enum';

@Entity('campaign_recipients')
@Index(['campaignId', 'status'])
export class CampaignRecipient {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty()
    @Column()
    campaignId: string;

    @ManyToOne(() => Campaign, (campaign) => campaign.recipients, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campaignId' })
    campaign: Campaign;

    @ApiProperty()
    @Column()
    userId: string;

    @ApiProperty()
    @Column()
    email: string;

    @ApiProperty({ enum: RecipientStatus })
    @Column({ type: 'enum', enum: RecipientStatus, default: RecipientStatus.PENDING })
    status: RecipientStatus;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    sentAt?: Date;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    variantId?: string;
}
