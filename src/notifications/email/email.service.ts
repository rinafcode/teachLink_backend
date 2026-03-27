import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private templatesCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE') || false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`;

    await this.emailQueue.add(
      'send-email',
      {
        to: email,
        subject: 'Verify Your Email - TeachLink',
        template: 'verification',
        context: {
          verificationUrl,
          appUrl,
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Verification email queued for ${email}`);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    await this.emailQueue.add(
      'send-email',
      {
        to: email,
        subject: 'Reset Your Password - TeachLink',
        template: 'reset-password',
        context: {
          resetUrl,
          appUrl,
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Password reset email queued for ${email}`);
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const template = await this.getTemplate(options.template);
      const html = template(options.context);

      const mailOptions = {
        from: `${this.configService.get<string>('EMAIL_FROM_NAME')} <${this.configService.get<string>('EMAIL_FROM')}>`,
        to: options.to,
        subject: options.subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error.stack);
      throw error;
    }
  }

  private async getTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    if (this.templatesCache.has(templateName)) {
      return this.templatesCache.get(templateName);
    }

    const templatePath = path.join(
      __dirname,
      'templates',
      `${templateName}.hbs`,
    );

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateSource);

    this.templatesCache.set(templateName, template);
    return template;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Email service connection verified');
      return true;
    } catch (error) {
      this.logger.error('Email service connection failed', error.stack);
      return false;
    }
  }
}
