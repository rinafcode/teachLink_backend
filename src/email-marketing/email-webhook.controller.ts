import { Controller, Post, Body, Headers, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { EmailTrackingService } from './services/email-tracking.service';
import { ConfigService } from '@nestjs/config';
import { EmailEventType } from './enums/email-event-type.enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendGridWebhookEventDto } from './dto/sendgrid-webhook-event.dto';

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
    @Body() events: unknown[],
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

    const eventInstances = plainToInstance(SendGridWebhookEventDto, events as object[]);
    const validationResults = await Promise.all(
      eventInstances.map((event) =>
        validate(event, {
          whitelist: true,
          forbidNonWhitelisted: false,
          stopAtFirstError: false,
        }),
      ),
    );
    const validationErrors = validationResults.flat();

    if (validationErrors.length > 0) {
      this.logger.warn('SendGrid webhook payload failed validation');
      throw new HttpException('Invalid webhook event payload', HttpStatus.BAD_REQUEST);
    }

    for (const event of eventInstances) {
      try {
        const baseData = {
          to: event.email,
          campaignId: event.asm?.group_id ?? null,
          recipientId: event.email,
          metadata: event.custom_args ?? {},
        };
        switch (event.event) {
          case EmailEventType.PROCESSED:
            await this.emailTrackingService.recordSent(baseData);
            break;
          case EmailEventType.DELIVERED:
            await this.emailTrackingService.recordDelivered(baseData);
            break;
          case EmailEventType.OPEN:
            await this.emailTrackingService.recordOpen(baseData);
            break;
          case EmailEventType.CLICK:
            await this.emailTrackingService.recordClick(baseData);
            break;
          case EmailEventType.BOUNCE:
            await this.emailTrackingService.recordBounce(baseData, event.reason);
            break;
          case EmailEventType.SPAMREPORT:
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
