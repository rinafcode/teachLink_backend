import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupService } from '../backup.service';
import { AlertingService } from '../../monitoring/alerting/alerting.service';
import { FileStorageService } from '../../media/storage/file-storage.service';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);
const RTO_THRESHOLD_SECONDS = 900; // 15 minutes

@Injectable()
export class DisasterRecoveryService {
  private readonly logger = new Logger(DisasterRecoveryService.name);
  private readonly kmsClient: KMSClient;

  constructor(
    private readonly backupService: BackupService,
    private readonly alertingService: AlertingService,
    private readonly fileStorageService: FileStorageService,
    private readonly configService: ConfigService,
  ) {
    const awsRegion = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.kmsClient = new KMSClient({ region: awsRegion });
  }

  async executeRestore(backupId: string): Promise<void> {
    this.logger.log(`Starting disaster recovery restore for backup: ${backupId}`);

    const rtoStartTime = Date.now();

    try {
      // Step 1: Get latest verified backup
      const backup = await this.backupService.getLatestBackup();
      if (!backup) {
        throw new Error('No verified backup available for restore');
      }

      // Step 2: Download from secondary region
      this.logger.log('Downloading backup from secondary region');
      const backupData = await this.fileStorageService.downloadFile(
        backup.replicatedStorageKey || backup.encryptedStorageKey,
      );

      // Step 3: Decrypt with AWS KMS
      this.logger.log('Decrypting backup');
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: backupData,
      });
      const decryptResponse = await this.kmsClient.send(decryptCommand);
      const decryptedData = Buffer.from(decryptResponse.Plaintext);

      // Save to temp file
      const tempFile = `/tmp/disaster-recovery-${backupId}.sql`;
      await fs.promises.writeFile(tempFile, decryptedData);

      // Step 4: Execute pg_restore to primary database
      this.logger.log('Restoring to primary database');
      const databaseName = this.configService.get<string>('DB_DATABASE', 'teachlink');
      await this.restoreDatabase(databaseName, tempFile);

      // Cleanup
      await fs.promises.unlink(tempFile);

      // Step 5: Check RTO
      const rtoActual = Math.floor((Date.now() - rtoStartTime) / 1000);
      this.logger.log(`Disaster recovery completed. RTO: ${rtoActual} seconds`);

      if (rtoActual > RTO_THRESHOLD_SECONDS) {
        this.alertingService.sendAlert(
          'DISASTER_RECOVERY_RTO_EXCEEDED',
          `Disaster recovery completed but RTO exceeded: ${rtoActual}s > ${RTO_THRESHOLD_SECONDS}s`,
          'CRITICAL',
        );
      } else {
        this.alertingService.sendAlert(
          'DISASTER_RECOVERY_SUCCESS',
          `Disaster recovery completed successfully in ${rtoActual} seconds`,
          'INFO',
        );
      }
    } catch (error) {
      this.logger.error('Disaster recovery failed:', error);
      this.alertingService.sendAlert(
        'DISASTER_RECOVERY_FAILED',
        `Disaster recovery failed: ${error.message}`,
        'CRITICAL',
      );
      throw error;
    }
  }

  private async restoreDatabase(
    dbName: string,
    backupFile: string,
  ): Promise<void> {
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<string>('DB_PORT', '5432');
    const username = this.configService.get<string>('DB_USERNAME', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', '');

    const restoreCommand = `PGPASSWORD="${password}" pg_restore -h ${host} -p ${port} -U ${username} -d ${dbName} -c ${backupFile}`;

    await execAsync(restoreCommand);
  }
}
