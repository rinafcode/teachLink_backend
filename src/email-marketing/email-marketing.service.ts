import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Campaign } from './entities/campaign.entity';
import { CampaignRecipient } from './entities/campaign-recipient.entity';
import { SegmentationService } from './segmentation/segmentation.service';
import { TemplateManagementService } from './templates/template-management.service';
import { ABTestingService } from './ab-testing/ab-testing.service';
import { EmailAnalyticsService } from './analytics/email-analytics.service';

import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ScheduleCampaignDto } from './dto/schedule-campaign.dto';
import { CampaignStatus } from './enums/campaign-status.enum';

@Injectable()
export class EmailMarketingService {
    constructor(
        @InjectRepository(Campaign)
        private readonly campaignRepository: Repository<Campaign>,
        @InjectRepository(CampaignRecipient)
        private readonly recipientRepository: Repository<CampaignRecipient>,
        @InjectQueue('email-marketing')
        private readonly emailQueue: Queue,
        private readonly segmentationService: SegmentationService,
        private readonly templateService: TemplateManagementService,
        private readonly abTestingService: ABTestingService,
        private readonly analyticsService: EmailAnalyticsService,
    ) { }

    /**
     * Create a new email campaign
     */
    async createCampaign(createCampaignDto: CreateCampaignDto): Promise<Campaign> {
        // Validate template exists
        if (createCampaignDto.templateId) {
            await this.templateService.findOne(createCampaignDto.templateId);
        }

        // Validate segments exist
        if (createCampaignDto.segmentIds?.length) {
            for (const segmentId of createCampaignDto.segmentIds) {
                await this.segmentationService.findOne(segmentId);
            }
        }

        const campaign = this.campaignRepository.create({
            ...createCampaignDto,
            status: CampaignStatus.DRAFT,
        });

        return this.campaignRepository.save(campaign);
    }

    /**
     * Get all campaigns with pagination
     */
    async findAll(page: number = 1, limit: number = 10): Promise<{
        campaigns: Campaign[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const [campaigns, total] = await this.campaignRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
            relations: ['template'],
        });

        return {
            campaigns,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get a single campaign by ID
     */
    async findOne(id: string): Promise<Campaign> {
        const campaign = await this.campaignRepository.findOne({
            where: { id },
            relations: ['template', 'abTest', 'recipients'],
        });

        if (!campaign) {
            throw new NotFoundException(`Campaign with ID ${id} not found`);
        }

        return campaign;
    }

    /**
     * Update a campaign
     */
    async update(id: string, updateCampaignDto: UpdateCampaignDto): Promise<Campaign> {
        const campaign = await this.findOne(id);

        if (campaign.status === CampaignStatus.SENT) {
            throw new BadRequestException('Cannot update a sent campaign');
        }

        Object.assign(campaign, updateCampaignDto);
        return this.campaignRepository.save(campaign);
    }

    /**
     * Delete a campaign
     */
    async remove(id: string): Promise<void> {
        const campaign = await this.findOne(id);

        if (campaign.status === CampaignStatus.SENDING) {
            throw new BadRequestException('Cannot delete a campaign that is currently sending');
        }

        await this.campaignRepository.remove(campaign);
    }

    /**
     * Schedule a campaign for future sending
     */
    async scheduleCampaign(id: string, scheduleDto: ScheduleCampaignDto): Promise<Campaign> {
        const campaign = await this.findOne(id);

        if (campaign.status !== CampaignStatus.DRAFT) {
            throw new BadRequestException('Only draft campaigns can be scheduled');
        }

        const scheduledDate = new Date(scheduleDto.scheduledAt);
        if (scheduledDate <= new Date()) {
            throw new BadRequestException('Scheduled date must be in the future');
        }

        campaign.scheduledAt = scheduledDate;
        campaign.status = CampaignStatus.SCHEDULED;

        // Add to queue with delay
        const delay = scheduledDate.getTime() - Date.now();
        await this.emailQueue.add(
            'send-campaign',
            { campaignId: id },
            { delay, jobId: `campaign-${id}` },
        );

        return this.campaignRepository.save(campaign);
    }

    /**
     * Send a campaign immediately
     */
    async sendCampaign(id: string): Promise<Campaign> {
        const campaign = await this.findOne(id);

        if (campaign.status === CampaignStatus.SENT || campaign.status === CampaignStatus.SENDING) {
            throw new BadRequestException('Campaign has already been sent or is sending');
        }

        // Get recipients from segments
        const recipients = await this.segmentationService.getUsersFromSegments(
            campaign.segmentIds || [],
        );

        if (recipients.length === 0) {
            throw new BadRequestException('No recipients found for this campaign');
        }

        // Update campaign status
        campaign.status = CampaignStatus.SENDING;
        campaign.sentAt = new Date();
        campaign.totalRecipients = recipients.length;
        await this.campaignRepository.save(campaign);

        // Queue emails for sending
        await this.emailQueue.add('process-campaign', {
            campaignId: id,
            recipients: recipients.map((r) => r.id),
        });

        return campaign;
    }

    /**
     * Pause a scheduled or sending campaign
     */
    async pauseCampaign(id: string): Promise<Campaign> {
        const campaign = await this.findOne(id);

        if (campaign.status !== CampaignStatus.SCHEDULED && campaign.status !== CampaignStatus.SENDING) {
            throw new BadRequestException('Only scheduled or sending campaigns can be paused');
        }

        // Remove from queue if scheduled
        if (campaign.status === CampaignStatus.SCHEDULED) {
            await this.emailQueue.removeJobs(`campaign-${id}`);
        }

        campaign.status = CampaignStatus.PAUSED;
        return this.campaignRepository.save(campaign);
    }

    /**
     * Resume a paused campaign
     */
    async resumeCampaign(id: string): Promise<Campaign> {
        const campaign = await this.findOne(id);

        if (campaign.status !== CampaignStatus.PAUSED) {
            throw new BadRequestException('Only paused campaigns can be resumed');
        }

        // If it was scheduled, re-schedule
        if (campaign.scheduledAt && campaign.scheduledAt > new Date()) {
            return this.scheduleCampaign(id, { scheduledAt: campaign.scheduledAt.toISOString() });
        }

        // Otherwise, resume sending
        campaign.status = CampaignStatus.SENDING;
        await this.emailQueue.add('resume-campaign', { campaignId: id });

        return this.campaignRepository.save(campaign);
    }

    /**
     * Duplicate a campaign
     */
    async duplicateCampaign(id: string): Promise<Campaign> {
        const original = await this.findOne(id);

        const duplicate = this.campaignRepository.create({
            name: `${original.name} (Copy)`,
            subject: original.subject,
            previewText: original.previewText,
            templateId: original.templateId,
            segmentIds: original.segmentIds,
            content: original.content,
            status: CampaignStatus.DRAFT,
        });

        return this.campaignRepository.save(duplicate);
    }

    /**
     * Get campaign statistics
     */
    async getCampaignStats(id: string): Promise<{
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        unsubscribed: number;
        openRate: number;
        clickRate: number;
        bounceRate: number;
    }> {
        await this.findOne(id);
        return this.analyticsService.getCampaignMetrics(id);
    }
}
