import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email/email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly emailService: EmailService) {}

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    try {
      await this.emailService.sendVerificationEmail(email, token);
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error.stack);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    try {
      await this.emailService.sendPasswordResetEmail(email, token);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error.stack);
      throw error;
    }
  }
}
