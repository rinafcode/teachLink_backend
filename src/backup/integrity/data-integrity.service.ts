import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupRecord } from '../entities/backup-record.entity';
import { FileStorageService } from '../../media/storage/file-storage.service';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Injectable()
export class DataIntegrityService {
  private readonly logger = new Logger(DataIntegrityService.name);

  constructor(
    @InjectRepository(BackupRecord)
    private readonly backupRepository: Repository<BackupRecord>,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    this.logger.log(`Verifying backup integrity for: ${backupId}`);

    const backup = await this.backupRepository.findOne({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException(`Backup ${backupId} not found`);
    }

    if (!backup.encryptedStorageKey) {
      this.logger.error(
        `Backup ${backupId} has no encrypted storage key, cannot verify`,
      );
      return false;
    }

    try {
      // Download backup from S3
      const backupData = await this.fileStorageService.downloadFile(
        backup.encryptedStorageKey,
      );

      // Save to temp file
      const tempFile = `/tmp/verify-${backupId}.backup`;
      await fs.promises.writeFile(tempFile, backupData);

      // Calculate checksums
      const checksums = await this.calculateChecksums(tempFile);

      // Clean up temp file
      await fs.promises.unlink(tempFile);

      // Compare checksums
      const md5Match = checksums.md5 === backup.checksumMd5;
      const sha256Match = checksums.sha256 === backup.checksumSha256;

      if (md5Match && sha256Match) {
        this.logger.log(`Backup ${backupId} integrity verified successfully`);
        return true;
      } else {
        this.logger.error(
          `Backup ${backupId} integrity verification failed. MD5: ${md5Match}, SHA256: ${sha256Match}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Error verifying backup ${backupId} integrity:`,
        error,
      );
      return false;
    }
  }

  async calculateChecksums(
    filePath: string,
  ): Promise<{ md5: string; sha256: string }> {
    const fileBuffer = await fs.promises.readFile(filePath);

    const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const sha256 = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    return { md5, sha256 };
  }
}
