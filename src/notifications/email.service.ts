import { Injectable, Inject } from '@nestjs/common';
import { renderTemplate } from './email-templates';

@Injectable()
export class EmailService {
  constructor(
    @Inject('EMAIL_PROVIDER')
    private readonly emailProvider: {
      sendMail: (
        to: string,
        subject: string,
        body: string,
      ) => Promise<{ messageId: string }>;
    },
  ) {}

  async sendMail(
    to: string,
    subject: string,
    body: string,
  ): Promise<{ messageId: string }> {
    return this.emailProvider.sendMail(to, subject, body);
  }

  async sendTemplateMail(
    to: string,
    templateName: string,
    context: Record<string, any>,
  ): Promise<{ messageId: string }> {
    const body = renderTemplate(templateName, context);
    // In production, subject could also be templated or mapped
    return this.sendMail(to, 'Notification', body);
  }
}
