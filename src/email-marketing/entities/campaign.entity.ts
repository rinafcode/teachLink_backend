import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { EmailTemplate } from './email-template.entity';
import { ABTest } from './ab-test.entity';
import { CampaignRecipient } from './campaign-recipient.entity';
import { CampaignStatus } from '../enums/campaign-status.enum';

@Entity('email_campaigns')
export class Campaign {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column()
  @Index()
  name: string;

  @ApiProperty()
  @Column()
  @Index()
  subject: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  previewText?: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  content?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  @Index()
  templateId?: string;

  @ManyToOne(() => EmailTemplate, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template?: EmailTemplate;

  @ApiProperty({ type: [String] })
  @Column('simple-array', { nullable: true })
  segmentIds?: string[];

  @ApiProperty({ enum: CampaignStatus })
  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  @Index()
  status: CampaignStatus;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  @Index()
  scheduledAt?: Date;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  @Index()
  sentAt?: Date;

  @ApiProperty()
  @Column({ default: 0 })
  totalRecipients: number;

  @OneToOne(() => ABTest, (abTest) => abTest.campaign, { nullable: true })
  abTest?: ABTest;

  @OneToMany(() => CampaignRecipient, (recipient) => recipient.campaign)
  recipients: CampaignRecipient[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
