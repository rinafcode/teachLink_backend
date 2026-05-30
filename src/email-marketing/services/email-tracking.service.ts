import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailEvent } from '../entities/email-event.entity';
import { EmailEventType } from '../enums/email-event-type.enum';

@Injectable()
export class EmailTrackingService {
  private readonly logger = new Logger(EmailTrackingService.name);

  constructor(
    @InjectRepository(EmailEvent)
    private readonly emailEventRepo: Repository<EmailEvent>,
  ) {}

  async recordSent(data: Partial<EmailEvent>) {
    const event = this.emailEventRepo.create({
      ...data,
      eventType: EmailEventType.SENT,
    });

    await this.emailEventRepo.save(event);
    this.logger.log(`Email sent recorded for ${event.recipientId}`);
    return event;
  }

  async recordBounce(data: Partial<EmailEvent>, bounceReason?: string) {
    const event = this.emailEventRepo.create({
      ...data,
      eventType: EmailEventType.BOUNCED,
      bounceReason,
    });

    await this.emailEventRepo.save(event);
    this.logger.warn(
      `Email bounce recorded for ${event.recipientId}: ${bounceReason}`,
    );

    return event;
  }

  async recordComplaint(data: Partial<EmailEvent>, complaintType?: string) {
    const event = this.emailEventRepo.create({
      ...data,
      eventType: EmailEventType.COMPLAINED,
      complaintType,
    });

    await this.emailEventRepo.save(event);
    this.logger.warn(
      `Email complaint recorded for ${event.recipientId}: ${complaintType}`,
    );

    return event;
  }

  async updateReputation(score: number) {
    this.logger.log(`Reputation score updated to ${score}`);
  }

  async recordDelivered(data: Partial<EmailEvent>) {
    const event = this.emailEventRepo.create({
      ...data,
      eventType: EmailEventType.DELIVERED,
    });

    await this.emailEventRepo.save(event);
    this.logger.log(`Email delivery recorded for ${event.recipientId}`);
    return event;
  }

  async recordOpen(data: Partial<EmailEvent>) {
    const event = this.emailEventRepo.create({
      ...data,
      eventType: EmailEventType.OPENED,
    });

    await this.emailEventRepo.save(event);
    this.logger.log(`Email open recorded for ${event.recipientId}`);
    return event;
  }

  async recordClick(data: Partial<EmailEvent>) {
    const event = this.emailEventRepo.create({
      ...data,
      eventType: EmailEventType.CLICKED,
    });

    await this.emailEventRepo.save(event);
    this.logger.log(`Email click recorded for ${event.recipientId}`);
    return event;
  }
}