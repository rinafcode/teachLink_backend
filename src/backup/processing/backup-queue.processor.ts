import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BackupRecord } from '../entities/backup-record.entity';
import { BackupStatus } from '../enums/backup-status.enum';
import { BackupService } from '../backup.service';
import { FileStorageService } from '../../media/storage/file-storage.service';
import { DataIntegrityService } from '../integrity/data-integrity.service';
import {
  BackupJobData,
  VerificationJobData,
  RecoveryTestJobData,
} from '../interfaces/backup.interfaces';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const execAsync = promisify(exec);
const MAX_RETRIES = 3;

@Processor('backup-processing')
export class BackupQueueProcessor {
  private readonly logger = new Logger(BackupQueueProcessor.name);
  private readonly kmsClient: KMSClient;
  private readonly s3Client: S3Client;

  constructor(
    @InjectRepository(BackupRecord)
    private readonly backupRepository: Repository<BackupRecord>,
    private readonly backupService: BackupService,
    private readonly fileStorageService: FileStorageService,
    private readonly dataIntegrityService: DataIntegrityService,
    private readonly configService: ConfigService,
  ) {
    const awsRegion = this.configService.get<string>('AWS_REGION', 'us-east-1');

    this.kmsClient = new KMSClient({
      region: awsRegion,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });

    this.s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  @Process('create-backup')
  async handleCreateBackup(job: Job<BackupJobData>) {
    const { backupRecordId, databaseName } = job.data;
    this.logger.log(`Processing backup creation for: ${backupRecordId}`);

    const backup = await this.backupRepository.findOne({
      where: { id: backupRecordId },
    });
    if (!backup) {
      this.logger.warn(`Backup ${backupRecordId} not found, skipping`);
      return;
    }

    try {
      // Step 1: Create pg_dump
      await this.backupService.updateBackupStatus(
        backupRecordId,
        BackupStatus.IN_PROGRESS,
      );
      const dumpStartTime = Date.now();

      const tempFile = path.join('/tmp', `backup-${backupRecordId}.sql`);
      const pgDumpCommand = this.buildPgDumpCommand(databaseName, tempFile);

      await execAsync(pgDumpCommand);
      const dumpDuration = Date.now() - dumpStartTime;

      const stats = await fs.promises.stat(tempFile);
      backup.backupSizeBytes = stats.size;

      // Step 2: Upload to S3
      const uploadStartTime = Date.now();
      const storageKey = `backups/${backup.region}/${databaseName}/${backupRecordId}.sql`;
      const fileBuffer = await fs.promises.readFile(tempFile);

      await this.fileStorageService.uploadProcessedFile(
        fileBuffer,
        storageKey,
        'application/sql',
      );

      const uploadDuration = Date.now() - uploadStartTime;
      backup.storageKey = storageKey;

      // Step 3: Encrypt with AWS KMS
      const encryptionStartTime = Date.now();
      const kmsKeyId = this.configService.get<string>('AWS_KMS_KEY_ID');
      const encryptedKey = await this.encryptBackup(storageKey, kmsKeyId);
      backup.encryptedStorageKey = encryptedKey;
      backup.kmsKeyId = kmsKeyId;

      const encryptionDuration = Date.now() - encryptionStartTime;

      // Step 4: Replicate to secondary region
      const replicationStartTime = Date.now();
      const secondaryRegion = this.configService.get<string>(
        'BACKUP_SECONDARY_REGION',
        'us-west-2',
      );
      const replicatedKey = await this.replicateToRegion(
        encryptedKey,
        secondaryRegion,
      );
      backup.replicatedStorageKey = replicatedKey;

      const replicationDuration = Date.now() - replicationStartTime;

      // Step 5: Calculate checksums
      const checksums = await this.dataIntegrityService.calculateChecksums(
        tempFile,
      );
      backup.checksumMd5 = checksums.md5;
      backup.checksumSha256 = checksums.sha256;

      // Cleanup temp file
      await fs.promises.unlink(tempFile);

      // Update metadata
      backup.metadata = {
        ...backup.metadata,
        endTime: new Date(),
        dumpDuration,
        uploadDuration,
        encryptionDuration,
        replicationDuration,
      };

      await this.backupRepository.save(backup);

      // Queue verification job
      await (job.queue as any).add(
        'verify-backup',
        { backupRecordId, storageKey: encryptedKey },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      this.logger.log(`Backup ${backupRecordId} completed successfully`);
    } catch (error) {
      await this.handleProcessingError(backup, error, job.attemptsMade);
      throw error; // Re-throw to trigger retry
    }
  }

  @Process('verify-backup')
  async handleVerifyBackup(job: Job<VerificationJobData>) {
    const { backupRecordId } = job.data;
    this.logger.log(`Verifying backup integrity: ${backupRecordId}`);

    try {
      const isValid = await this.dataIntegrityService.verifyBackupIntegrity(
        backupRecordId,
      );

      if (isValid) {
        await this.backupService.updateBackupStatus(
          backupRecordId,
          BackupStatus.COMPLETED,
          {
            integrityVerified: true,
            verifiedAt: new Date(),
            completedAt: new Date(),
          },
        );
        this.logger.log(`Backup ${backupRecordId} verified successfully`);
      } else {
        throw new Error('Backup integrity verification failed');
      }
    } catch (error) {
      await this.backupService.updateBackupStatus(
        backupRecordId,
        BackupStatus.FAILED,
        {
          errorMessage: `Verification failed: ${error.message}`,
        },
      );
      throw error;
    }
  }

  @Process('recovery-test')
  async handleRecoveryTest(job: Job<RecoveryTestJobData>) {
    this.logger.log(`Recovery test processing handled by RecoveryTestingService`);
    // Delegated to RecoveryTestingService.executeRecoveryTest()
  }

  @Process('delete-backup')
  async handleDeleteBackup(job: Job<{ backupRecordId: string }>) {
    const { backupRecordId } = job.data;
    this.logger.log(`Deleting expired backup: ${backupRecordId}`);

    const backup = await this.backupRepository.findOne({
      where: { id: backupRecordId },
    });

    if (!backup) {
      this.logger.warn(`Backup ${backupRecordId} not found, skipping deletion`);
      return;
    }

    try {
      const bucketName = this.configService.get<string>('AWS_S3_BUCKET', '');

      // Delete from primary region
      if (backup.encryptedStorageKey) {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: backup.encryptedStorageKey,
          }),
        );
      }

      // Delete from secondary region (if replicated)
      if (backup.replicatedStorageKey) {
        const secondaryBucket = this.configService.get<string>(
          'AWS_S3_BUCKET_SECONDARY',
          bucketName,
        );
        const secondaryS3Client = new S3Client({
          region: this.configService.get<string>('BACKUP_SECONDARY_REGION', 'us-west-2'),
        });

        await secondaryS3Client.send(
          new DeleteObjectCommand({
            Bucket: secondaryBucket,
            Key: backup.replicatedStorageKey,
          }),
        );
      }

      // Delete from database
      await this.backupRepository.remove(backup);

      this.logger.log(`Backup ${backupRecordId} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete backup ${backupRecordId}:`, error);
      throw error;
    }
  }

  private buildPgDumpCommand(databaseName: string, outputFile: string): string {
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<string>('DB_PORT', '5432');
    const username = this.configService.get<string>('DB_USERNAME', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', '');

    return `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -F c -b -v -f ${outputFile} ${databaseName}`;
  }

  private async encryptBackup(
    storageKey: string,
    kmsKeyId: string,
  ): Promise<string> {
    const encryptedKey = `${storageKey}.encrypted`;

    // Download from S3, encrypt with KMS, re-upload
    const fileBuffer = await this.fileStorageService.downloadFile(storageKey);

    const command = new EncryptCommand({
      KeyId: kmsKeyId,
      Plaintext: fileBuffer,
    });

    const response = await this.kmsClient.send(command);

    await this.fileStorageService.uploadProcessedFile(
      Buffer.from(response.CiphertextBlob),
      encryptedKey,
      'application/octet-stream',
    );

    return encryptedKey;
  }

  private async replicateToRegion(
    storageKey: string,
    targetRegion: string,
  ): Promise<string> {
    this.logger.log(`Replicating ${storageKey} to ${targetRegion}`);

    const sourceBucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    const targetBucket = this.configService.get<string>(
      'AWS_S3_BUCKET_SECONDARY',
      sourceBucket,
    );

    const targetKey = storageKey.replace(`backups/`, `backups-${targetRegion}/`);

    const copyCommand = new CopyObjectCommand({
      CopySource: `${sourceBucket}/${storageKey}`,
      Bucket: targetBucket,
      Key: targetKey,
    });

    await this.s3Client.send(copyCommand);

    return targetKey;
  }

  private async handleProcessingError(
    backup: BackupRecord,
    error: Error,
    attemptsMade: number,
  ): Promise<void> {
    this.logger.error(`Backup processing failed for ${backup.id}:`, error);

    backup.retryCount = attemptsMade;
    backup.errorMessage = error.message;

    if (attemptsMade >= MAX_RETRIES) {
      backup.status = BackupStatus.FAILED;
      this.logger.error(`Max retries exceeded for backup ${backup.id}`);
    }

    await this.backupRepository.save(backup);
  }
}
