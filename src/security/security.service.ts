import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * Provides security operations.
 */
@Injectable()
export class SecurityService {
  /**
   * Executes enforce Retention Policy.
   * @returns The operation result.
   */
  @Cron('0 2 * * *')
  async enforceRetentionPolicy(): Promise<void> {
    const retentionDays = Number(process.env.DATA_RETENTION_DAYS);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  }
}
