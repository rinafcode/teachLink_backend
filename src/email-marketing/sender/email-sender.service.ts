import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { TemplateManagementService } from '../templates/template-management.service';
import { EmailAnalyticsService } from '../analytics/email-analytics.service';
import { EmailEventType } from '../enums/email-event-type.enum';

export interface SendEmailOptions {
    to: string;
    subject?: string;
    templateId?: string;
    html?: string;
    text?: string;
    variables?: Record<string, any>;
    campaignId?: string;
    recipientId?: string;
    variantId?: string;
    trackOpens?: boolean;
    trackClicks?: boolean;
}

export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

@Injectable()
export class EmailSenderService {
    private readonly logger = new Logger(EmailSenderService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        private readonly configService: ConfigService,
        private readonly templateService: TemplateManagementService,
        private readonly analyticsService: EmailAnalyticsService,
    ) {
        this.initializeTransporter();
    }

    private initializeTransporter(): void {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST', 'smtp.mailtrap.io'),
            port: this.configService.get('SMTP_PORT', 587),
            secure: this.configService.get('SMTP_SECURE', false),
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });
    }

    /**
     * Send a single email
     */
    async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
        try {
            let html = options.html;
            let text = options.text;
            let subject = options.subject;

            // Render template if provided
            if (options.templateId) {
                const rendered = await this.templateService.renderTemplate(
                    options.templateId,
                    options.variables || {},
                );
                html = rendered.html;
                text = rendered.text;
                subject = rendered.subject;
            }

            // Add tracking pixel for opens
            if (options.trackOpens && options.campaignId && options.recipientId) {
                html = this.addOpenTrackingPixel(html, options.campaignId, options.recipientId);
            }

            // Track link clicks
            if (options.trackClicks && options.campaignId && options.recipientId) {
                html = this.wrapLinksForTracking(html, options.campaignId, options.recipientId);
            }

            const fromEmail = this.configService.get('EMAIL_FROM', 'noreply@teachlink.io');
            const fromName = this.configService.get('EMAIL_FROM_NAME', 'TeachLink');

            const result = await this.transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: options.to,
                subject,
                html,
                text,
            });

            // Record sent event
            if (options.campaignId && options.recipientId) {
                await this.analyticsService.recordEvent(
                    options.campaignId,
                    options.recipientId,
                    EmailEventType.SENT,
                    { messageId: result.messageId, variantId: options.variantId },
                );
            }

            this.logger.log(`Email sent to ${options.to}, messageId: ${result.messageId}`);

            return { success: true, messageId: result.messageId };
        } catch (error) {
            this.logger.error(`Failed to send email to ${options.to}:`, error);

            // Record bounce event
            if (options.campaignId && options.recipientId) {
                await this.analyticsService.recordEvent(
                    options.campaignId,
                    options.recipientId,
                    EmailEventType.BOUNCED,
                    { error: error.message },
                );
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Send bulk emails
     */
    async sendBulkEmails(
        recipients: Array<{ email: string; id: string; variables?: Record<string, any> }>,
        options: Omit<SendEmailOptions, 'to' | 'recipientId'>,
    ): Promise<{ sent: number; failed: number; results: SendEmailResult[] }> {
        const results: SendEmailResult[] = [];
        let sent = 0;
        let failed = 0;

        for (const recipient of recipients) {
            const result = await this.sendEmail({
                ...options,
                to: recipient.email,
                recipientId: recipient.id,
                variables: { ...options.variables, ...recipient.variables },
            });

            results.push(result);
            if (result.success) sent++;
            else failed++;

            // Small delay to avoid rate limiting
            await this.delay(50);
        }

        return { sent, failed, results };
    }

    /**
     * Verify SMTP connection
     */
    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            this.logger.error('SMTP connection verification failed:', error);
            return false;
        }
    }

    // Private helper methods
    private addOpenTrackingPixel(html: string, campaignId: string, recipientId: string): string {
        const baseUrl = this.configService.get('APP_URL', 'http://localhost:3000');
        const trackingUrl = `${baseUrl}/email-marketing/track/open?c=${campaignId}&r=${recipientId}`;
        const pixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;

        return html.replace('</body>', `${pixel}</body>`);
    }

    private wrapLinksForTracking(html: string, campaignId: string, recipientId: string): string {
        const baseUrl = this.configService.get('APP_URL', 'http://localhost:3000');

        return html.replace(
            /<a\s+([^>]*href=["'])([^"']+)(["'][^>]*)>/gi,
            (match, prefix, url, suffix) => {
                if (url.startsWith('mailto:') || url.startsWith('#')) {
                    return match;
                }
                const trackingUrl = `${baseUrl}/email-marketing/track/click?c=${campaignId}&r=${recipientId}&url=${encodeURIComponent(url)}`;
                return `<a ${prefix}${trackingUrl}${suffix}>`;
            },
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
