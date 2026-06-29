import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Handlebars from 'handlebars';
import sanitizeHtml from 'sanitize-html';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationType } from '../entities/notification.entity';

export interface RenderedTemplate {
  subject?: string;
  body: string;
  templateVersion: number;
}

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
  ) {}

  async getTemplate(name: string, templateVersion?: number): Promise<NotificationTemplate> {
    const where: Partial<NotificationTemplate> = { name, isActive: true };
    if (templateVersion !== undefined) {
      where.templateVersion = templateVersion;
    }
    const template = await this.templateRepository.findOne({
      where,
      order: { templateVersion: 'DESC' },
    });

    if (!template) {
      throw new NotFoundException(`Notification template "${name}" not found`);
    }
    return template;
  }

  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sanitizeOptions: any = {
      allowedTags: [], // Disallow all HTML tags for most user input
      allowedAttributes: {},
    };

    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        // URLs are an exception - we need to allow them to work properly
        if (key.includes('url') || key.includes('link') || key.includes('href')) {
          sanitized[key] = sanitizeHtml(value, {
            allowedTags: [],
            allowedAttributes: {},
            allowedSchemes: ['http', 'https', 'mailto'],
          });
        } else {
          sanitized[key] = sanitizeHtml(value, sanitizeOptions);
        }
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  render(template: NotificationTemplate, context: Record<string, unknown>): RenderedTemplate {
    const sanitizedContext = this.sanitizeContext(context);
    const bodyCompiler = Handlebars.compile(template.bodyTemplate);
    const body = bodyCompiler(sanitizedContext);
    let subject: string | undefined;
    if (template.subjectTemplate) {
      subject = Handlebars.compile(template.subjectTemplate)(sanitizedContext);
    }
    return {
      subject,
      body,
      templateVersion: template.templateVersion,
    };
  }

  async renderByName(
    name: string,
    context: Record<string, unknown>,
    templateVersion?: number,
    channel?: NotificationType,
  ): Promise<RenderedTemplate> {
    const where: Partial<NotificationTemplate> = { name, isActive: true };
    if (templateVersion !== undefined) {
      where.templateVersion = templateVersion;
    }
    if (channel !== undefined) {
      where.channel = channel;
    }

    const template = await this.templateRepository.findOne({
      where,
      order: { templateVersion: 'DESC' },
    });
    if (!template) {
      throw new NotFoundException(`Notification template "${name}" not found`);
    }
    return this.render(template, context);
  }

  async seedDefaultTemplates(): Promise<void> {
    const defaults: Partial<NotificationTemplate>[] = [
      {
        name: 'course_update',
        templateVersion: 1,
        channel: NotificationType.EMAIL,
        subjectTemplate: 'Course update: {{courseName}}',
        bodyTemplate: '<p>Hello {{userName}},</p><p>{{message}}</p>',
      },
      {
        name: 'course_update',
        templateVersion: 1,
        channel: NotificationType.IN_APP,
        bodyTemplate: '{{message}}',
      },
      {
        name: 'enrollment_confirmed',
        templateVersion: 1,
        channel: NotificationType.PUSH,
        bodyTemplate: 'You enrolled in {{courseName}}',
      },
      {
        name: 'instructor_payout',
        templateVersion: 1,
        channel: NotificationType.EMAIL,
        subjectTemplate: 'Your payout of {{amount}} {{currency}} has been processed!',
        bodyTemplate:
          '<p>Hello {{instructorName}},</p><p>We are pleased to inform you that your payout of <strong>{{amount}} {{currency}}</strong> has been successfully processed via {{payoutMethod}}.</p><p>Details: {{payoutDetails}}</p><p>Thank you for teaching on TeachLink!</p>',
      },
    ];

    for (const def of defaults) {
      const exists = await this.templateRepository.findOne({
        where: { name: def.name, templateVersion: def.templateVersion, channel: def.channel },
      });
      if (!exists) {
        await this.templateRepository.save(this.templateRepository.create(def));
      }
    }
    this.logger.log('Default notification templates seeded');
  }
}
