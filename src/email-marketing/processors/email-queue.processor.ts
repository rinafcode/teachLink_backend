import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Campaign } from '../entities/campaign.entity';
import { CampaignRecipient } from '../entities/campaign-recipient.entity';
import { EmailSenderService } from '../sender/email-sender.service';
import { SegmentationService } from '../segmentation/segmentation.service';
import { ABTestingService } from '../ab-testing/ab-testing.service';
import { CampaignStatus } from '../enums/campaign-status.enum';
import { RecipientStatus } from '../enums/recipient-status.enum';

@Processor('email-marketing')
export class EmailQueueProcessor {
    private readonly logger = new Logger(EmailQueueProcessor.name);

    constructor(
        @InjectRepository(Campaign)
        private readonly campaignRepository: Repository<Campaign>,
        @InjectRepository(CampaignRecipient)
        private readonly recipientRepository: Repository<CampaignRecipient>,
        private readonly emailSenderService: EmailSenderService,
        private readonly segmentationService: SegmentationService,
        private readonly abTestingService: ABTestingService,
    ) { }

    @Process('send-campaign')
    async handleScheduledCampaign(job: Job<{ campaignId: string }>) {
        this.logger.log(`Processing scheduled campaign: ${job.data.campaignId}`);

        const campaign = await this.campaignRepository.findOne({
            where: { id: job.data.campaignId },
            relations: ['abTest', 'abTest.variants'],
        });

        if (!campaign || campaign.status !== CampaignStatus.SCHEDULED) {
            this.logger.warn(`Campaign ${job.data.campaignId} not found or not scheduled`);
            return;
        }

        // Get recipients
        const users = await this.segmentationService.getUsersFromSegments(campaign.segmentIds || []);

        campaign.status = CampaignStatus.SENDING;
        campaign.sentAt = new Date();
        campaign.totalRecipients = users.length;
        await this.campaignRepository.save(campaign);

        await this.processRecipients(campaign, users);
    }

    @Process('process-campaign')
    async handleCampaignProcessing(job: Job<{ campaignId: string; recipients: string[] }>) {
        this.logger.log(`Processing campaign: ${job.data.campaignId}`);

        const campaign = await this.campaignRepository.findOne({
            where: { id: job.data.campaignId },
            relations: ['abTest', 'abTest.variants'],
        });

        if (!campaign) {
            return;
        }

        // Fetch user details for recipients
        // TODO: Integrate with Users module
        const users = job.data.recipients.map((id) => ({
            id,
            email: `user-${id}@example.com`, // Placeholder
        }));

        await this.processRecipients(campaign, users);
    }

    @Process('send-automation-email')
    async handleAutomationEmail(job: Job<{
        actionId: string;
        templateId: string;
        userId: string;
        variables: Record<string, any>;
    }>) {
        this.logger.log(`Sending automation email for action: ${job.data.actionId}`);

        // TODO: Get user email from Users module
        const userEmail = `user-${job.data.userId}@example.com`;

        await this.emailSenderService.sendEmail({
            to: userEmail,
            templateId: job.data.templateId,
            variables: job.data.variables,
            trackOpens: true,
            trackClicks: true,
        });
    }

    @Process('resume-campaign')
    async handleResumeCampaign(job: Job<{ campaignId: string }>) {
        this.logger.log(`Resuming campaign: ${job.data.campaignId}`);

        const pendingRecipients = await this.recipientRepository.find({
            where: {
                campaignId: job.data.campaignId,
                status: RecipientStatus.PENDING,
            },
        });

        const campaign = await this.campaignRepository.findOne({
            where: { id: job.data.campaignId },
            relations: ['abTest', 'abTest.variants'],
        });

        if (!campaign) return;

        for (const recipient of pendingRecipients) {
            await this.sendToRecipient(campaign, recipient);
        }

        await this.finalizeCampaign(job.data.campaignId);
    }

    // Private helper methods
    private async processRecipients(
        campaign: Campaign,
        users: Array<{ id: string; email: string }>,
    ): Promise<void> {
        // Create recipient records
        const recipients = users.map((user) =>
            this.recipientRepository.create({
                campaignId: campaign.id,
                userId: user.id,
                email: user.email,
                status: RecipientStatus.PENDING,
            }),
        );

        await this.recipientRepository.save(recipients);

        // Process in batches
        const batchSize = 100;
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            await Promise.all(batch.map((recipient) => this.sendToRecipient(campaign, recipient)));

            // Update progress
            const progress = Math.round(((i + batch.length) / recipients.length) * 100);
            this.logger.log(`Campaign ${campaign.id} progress: ${progress}%`);
        }

        await this.finalizeCampaign(campaign.id);
    }

    private async sendToRecipient(campaign: Campaign, recipient: CampaignRecipient): Promise<void> {
        try {
            // Select A/B test variant if applicable
            let variantId: string | undefined;
            let templateId = campaign.templateId;

            if (campaign.abTest) {
                const variant = this.abTestingService.selectVariantForRecipient(campaign.abTest);
                variantId = variant.id;
                templateId = variant.templateId || templateId;
            }

            const result = await this.emailSenderService.sendEmail({
                to: recipient.email,
                templateId,
                variables: { userId: recipient.userId },
                campaignId: campaign.id,
                recipientId: recipient.id,
                variantId,
                trackOpens: true,
                trackClicks: true,
            });

            recipient.status = result.success ? RecipientStatus.SENT : RecipientStatus.FAILED;
            recipient.sentAt = new Date();

            await this.recipientRepository.save(recipient);
        } catch (error) {
            this.logger.error(`Failed to send to ${recipient.email}:`, error);
            recipient.status = RecipientStatus.FAILED;
            await this.recipientRepository.save(recipient);
        }
    }

    private async finalizeCampaign(campaignId: string): Promise<void> {
        const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });

        if (campaign && campaign.status === CampaignStatus.SENDING) {
            campaign.status = CampaignStatus.SENT;
            await this.campaignRepository.save(campaign);
            this.logger.log(`Campaign ${campaignId} completed`);
        }
    }
}
