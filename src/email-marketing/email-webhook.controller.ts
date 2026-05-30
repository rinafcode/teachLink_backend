import { Controller, Post, Body, Headers, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { EmailTrackingService } from './services/email-tracking.service';
import { ConfigService } from '@nestjs/config';
import { EmailEventType } from './enums/email-event-type.enum';

/**
 * Controller to receive SendGrid webhook events for email deliverability tracking.
 * The webhook is expected to be configured in SendGrid with the endpoint `/email/webhook`.
 * Authentication is performed via a simple Bearer token defined in `SENDGRID_WEBHOOK_TOKEN`.
 */
@Controller('email')
export class EmailWebhookController {
  private readonly logger = new Logger(EmailWebhookController.name);

  constructor(
    private readonly emailTrackingService: EmailTrackingService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('authorization') authHeader: string,
    @Body() events: any[],
  ) {
    const expectedToken = this.configService.get<string>('SENDGRID_WEBHOOK_TOKEN');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Missing Authorization header on webhook');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    const token = authHeader.split(' ')[1];
    if (token !== expectedToken) {
      this.logger.warn('Invalid webhook token');
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    if (!Array.isArray(events)) {
      this.logger.warn('Invalid webhook payload format');
      throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    }

    for (const event of events) {
      try {
        const baseData = {
          to: event.email,
          campaignId: event.asm?.group_id ?? null,
          recipientId: event.email,
          metadata: event.custom_args ?? {},
        };
        switch (event.event) {
          case 'processed':
            // email has been accepted for delivery – could be recorded as sent if desired
            await this.emailTrackingService.recordSent(baseData);
            break;
          case 'delivered':
            await this.emailTrackingService.recordDelivered(baseData);
            break;
          case 'open':
            await this.emailTrackingService.recordOpen(baseData);
            break;
          case 'click':
            await this.emailTrackingService.recordClick(baseData);
            break;
          case 'bounce':
            await this.emailTrackingService.recordBounce(baseData, event.reason);
            break;
          case 'spamreport':
            // SendGrid uses 'spamreport' for complaints
            await this.emailTrackingService.recordComplaint(baseData, 'spamreport');
            break;
          default:
            this.logger.debug(`Unhandled SendGrid event type: ${event.event}`);
        }
      } catch (err) {
        this.logger.error(`Failed processing webhook event: ${JSON.stringify(event)}`, err);
      }
    }

    return { received: true };
  }
}
