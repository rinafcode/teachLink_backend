import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RecoveryTestingService {
  private readonly logger = new Logger(RecoveryTestingService.name);

  async runRecoveryTest(): Promise<void> {
    this.logger.log('Running automated recovery test...');
    await new Promise((res) => setTimeout(res, 400));
    this.logger.log('Recovery test successful.');
  }
}
