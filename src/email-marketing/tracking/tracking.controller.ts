import { Controller, Get, Query, Res, Redirect } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';

import { EmailAnalyticsService } from '../analytics/email-analytics.service';
import { EmailEventType } from '../enums/email-event-type.enum';

/**
 * Tracking controller for email opens and clicks
 * These endpoints are called by tracking pixels and wrapped links in emails
 */
@ApiTags('Email Marketing - Tracking')
@Controller('email-marketing/track')
export class TrackingController {
    // 1x1 transparent GIF pixel
    private readonly TRACKING_PIXEL = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
    );

    constructor(private readonly analyticsService: EmailAnalyticsService) { }

    /**
     * Track email open via 1x1 tracking pixel
     * Called when email client loads the tracking image
     */
    @Get('open')
    @ApiExcludeEndpoint() // Hide from Swagger as it's for internal use
    async trackOpen(
        @Query('c') campaignId: string,
        @Query('r') recipientId: string,
        @Res() res: Response,
    ): Promise<void> {
        // Record the open event asynchronously
        if (campaignId && recipientId) {
            this.analyticsService.recordEvent(
                campaignId,
                recipientId,
                EmailEventType.OPENED,
                { timestamp: new Date().toISOString() },
            ).catch((error) => {
                console.error('Failed to record open event:', error);
            });
        }

        // Return the tracking pixel
        res.set({
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.send(this.TRACKING_PIXEL);
    }

    /**
     * Track link click and redirect to original URL
     * Called when user clicks a tracked link in the email
     */
    @Get('click')
    @ApiOperation({ summary: 'Track email link click and redirect' })
    async trackClick(
        @Query('c') campaignId: string,
        @Query('r') recipientId: string,
        @Query('url') url: string,
        @Res() res: Response,
    ): Promise<void> {
        // Validate URL to prevent open redirect vulnerability
        const decodedUrl = decodeURIComponent(url || '');

        if (!this.isValidRedirectUrl(decodedUrl)) {
            res.status(400).send('Invalid URL');
            return;
        }

        // Record the click event asynchronously
        if (campaignId && recipientId) {
            this.analyticsService.recordEvent(
                campaignId,
                recipientId,
                EmailEventType.CLICKED,
                {
                    url: decodedUrl,
                    timestamp: new Date().toISOString(),
                },
            ).catch((error) => {
                console.error('Failed to record click event:', error);
            });
        }

        // Redirect to the original URL
        res.redirect(302, decodedUrl);
    }

    /**
     * Track email delivery (called by email service provider webhook)
     */
    @Get('delivered')
    @ApiExcludeEndpoint()
    async trackDelivered(
        @Query('c') campaignId: string,
        @Query('r') recipientId: string,
        @Res() res: Response,
    ): Promise<void> {
        if (campaignId && recipientId) {
            await this.analyticsService.recordEvent(
                campaignId,
                recipientId,
                EmailEventType.DELIVERED,
            );
        }
        res.status(200).send('OK');
    }

    /**
     * Track email bounce (called by email service provider webhook)
     */
    @Get('bounce')
    @ApiExcludeEndpoint()
    async trackBounce(
        @Query('c') campaignId: string,
        @Query('r') recipientId: string,
        @Query('type') bounceType: string,
        @Res() res: Response,
    ): Promise<void> {
        if (campaignId && recipientId) {
            const eventType = bounceType === 'soft'
                ? EmailEventType.SOFT_BOUNCED
                : EmailEventType.BOUNCED;

            await this.analyticsService.recordEvent(
                campaignId,
                recipientId,
                eventType,
                { bounceType },
            );
        }
        res.status(200).send('OK');
    }

    /**
     * Handle unsubscribe requests
     */
    @Get('unsubscribe')
    @ApiOperation({ summary: 'Unsubscribe from email list' })
    async unsubscribe(
        @Query('c') campaignId: string,
        @Query('r') recipientId: string,
        @Query('email') email: string,
        @Res() res: Response,
    ): Promise<void> {
        if (campaignId && recipientId) {
            await this.analyticsService.recordEvent(
                campaignId,
                recipientId,
                EmailEventType.UNSUBSCRIBED,
                { email },
            );
        }

        // TODO: Actually unsubscribe the user in the subscription service

        // Return a simple confirmation page
        res.set('Content-Type', 'text/html');
        res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed - TeachLink</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <h1>You've been unsubscribed</h1>
          <p>You will no longer receive marketing emails from TeachLink.</p>
          <p>If this was a mistake, you can update your preferences in your account settings.</p>
        </body>
      </html>
    `);
    }

    /**
     * Validate redirect URL to prevent open redirect attacks
     */
    private isValidRedirectUrl(url: string): boolean {
        if (!url) return false;

        try {
            const parsed = new URL(url);

            // Only allow http and https protocols
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return false;
            }

            // Optional: Add domain whitelist for extra security
            // const allowedDomains = ['teachlink.io', 'www.teachlink.io'];
            // if (!allowedDomains.includes(parsed.hostname)) {
            //   return false;
            // }

            return true;
        } catch {
            return false;
        }
    }
}
