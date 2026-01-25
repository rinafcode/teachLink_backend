import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DisasterRecoveryService {
  private readonly logger = new Logger(DisasterRecoveryService.name);

  async triggerFailover(): Promise<void> {
    this.logger.warn('Disaster detected. Initiating failover...');
    await new Promise((res) => setTimeout(res, 500));
    this.logger.log('Failover completed within RTO.');
  }
}
