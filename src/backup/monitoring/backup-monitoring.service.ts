import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BackupMonitoringService {
  private readonly logger = new Logger(BackupMonitoringService.name);

  alertFailure(reason: string): void {
    this.logger.error(`Backup failure detected: ${reason}`);
  }
}
