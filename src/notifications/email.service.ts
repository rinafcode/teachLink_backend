import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendMail(to: string, subject: string, body: string): Promise<{ messageId: string }> {
    // Mock sending email
    return { messageId: 'mock-id' };
  }
} 