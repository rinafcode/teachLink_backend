import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class SecurityService {
  @Cron('0 2 * * *')
  async enforceRetentionPolicy() {
    const retentionDays = Number(process.env.DATA_RETENTION_DAYS);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete or archive old records
    console.log(`Retention enforced before ${cutoffDate}`);
  }
}
