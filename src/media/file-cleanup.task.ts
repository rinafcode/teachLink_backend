import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaService } from './media.service';

@Injectable()
export class FileCleanupTask {
  private readonly logger = new Logger(FileCleanupTask.name);

  constructor(private readonly mediaService: MediaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanup() {
    this.logger.log('Starting scheduled file cleanup...');
    const deletedCount = await this.mediaService.cleanupExpiredFiles();
    this.logger.log(`Scheduled file cleanup completed. Deleted ${deletedCount} files.`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async logStorageUsage() {
    const stats = await this.mediaService.getStorageUsage();
    this.logger.log(
      `Current Storage Usage: ${stats.fileCount} files, ` +
      `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB total size`,
    );
  }
}
