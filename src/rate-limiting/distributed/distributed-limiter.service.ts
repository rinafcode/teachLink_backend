import { Injectable } from '@nestjs/common';

@Injectable()
export class DistributedLimiterService {
  // In production, use Redis or similar for distributed state
  async isAllowed(userId: string, endpoint: string): Promise<boolean> {
    // Placeholder: always allow
    return true;
  }
}
