import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { RecoveryTest } from '../entities/recovery-test.entity';
import { RecoveryTestStatus } from '../enums/recovery-test-status.enum';
import { BackupService } from '../backup.service';
import { RecoveryTestResponseDto } from '../dto/recovery-test-response.dto';
import { RecoveryTestJobData } from '../interfaces/backup.interfaces';
import { FileStorageService } from '../../media/storage/file-storage.service';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { AlertingService } from '../../monitoring/alerting/alerting.service';
import { Client } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

@Injectable()
export class RecoveryTestingService {
  private readonly logger = new Logger(RecoveryTestingService.name);
  private readonly kmsClient: KMSClient;

  constructor(
    @InjectRepository(RecoveryTest)
    private readonly recoveryTestRepository: Repository<RecoveryTest>,
    @InjectQueue('backup-processing')
    private readonly backupQueue: Queue,
    private readonly backupService: BackupService,
    private readonly fileStorageService: FileStorageService,
    private readonly configService: ConfigService,
    private readonly alertingService: AlertingService,
  ) {
    const awsRegion = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.kmsClient = new KMSClient({ region: awsRegion });
  }

  async createRecoveryTest(backupId: string): Promise<RecoveryTestResponseDto> {
    const backup = await this.backupService.getLatestBackup();
    if (!backup) {
      throw new NotFoundException(`No verified backup found`);
    }

    const testDatabaseName = this.configService.get<string>(
      'BACKUP_TEST_DATABASE',
      'teachlink_backup_test',
    );

    const recoveryTest = this.recoveryTestRepository.create({
      backupRecordId: backupId,
      status: RecoveryTestStatus.PENDING,
      testDatabaseName,
    });

    await this.recoveryTestRepository.save(recoveryTest);

    // Queue recovery test job
    await this.backupQueue.add(
      'recovery-test',
      {
        recoveryTestId: recoveryTest.id,
        backupRecordId: backupId,
        testDatabaseName,
      } as RecoveryTestJobData,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
      },
    );

    return this.toResponseDto(recoveryTest);
  }

  async executeRecoveryTest(testId: string): Promise<void> {
    const test = await this.recoveryTestRepository.findOne({
      where: { id: testId },
      relations: ['backupRecord'],
    });

    if (!test) {
      throw new NotFoundException(`Recovery test ${testId} not found`);
    }

    const totalStartTime = Date.now();

    try {
      test.status = RecoveryTestStatus.RUNNING;
      await this.recoveryTestRepository.save(test);

      // Step 1: Download encrypted backup
      const downloadStartTime = Date.now();
      const backupData = await this.fileStorageService.downloadFile(
        test.backupRecord.encryptedStorageKey,
      );
      const downloadDuration = Date.now() - downloadStartTime;

      // Step 2: Decrypt
      const decryptStartTime = Date.now();
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: backupData,
      });
      const decryptResponse = await this.kmsClient.send(decryptCommand);
      const decryptedData = Buffer.from(decryptResponse.Plaintext);
      const decryptionDuration = Date.now() - decryptStartTime;

      // Save to temp file
      const tempFile = `/tmp/recovery-test-${testId}.sql`;
      await fs.promises.writeFile(tempFile, decryptedData);

      // Step 3: Create test database
      await this.createTestDatabase(test.testDatabaseName);

      // Step 4: Restore
      const restoreStartTime = Date.now();
      await this.restoreDatabase(test.testDatabaseName, tempFile);
      const restoreDuration = Date.now() - restoreStartTime;

      // Step 5: Validate
      const validationStartTime = Date.now();
      const validationResults = await this.validateRestoredDatabase(
        test.testDatabaseName,
      );
      const validationDuration = Date.now() - validationStartTime;

      // Step 6: Cleanup
      await this.dropTestDatabase(test.testDatabaseName);
      await fs.promises.unlink(tempFile);

      // Update test results
      test.status = validationResults.connectionSuccessful
        ? RecoveryTestStatus.PASSED
        : RecoveryTestStatus.FAILED;
      test.validationResults = validationResults;
      test.performanceMetrics = {
        downloadDuration,
        decryptionDuration,
        restoreDuration,
        validationDuration,
        totalDuration: Date.now() - totalStartTime,
      };
      test.testCompletedAt = new Date();

      await this.recoveryTestRepository.save(test);

      // Send alert
      this.alertingService.sendAlert(
        'RECOVERY_TEST_COMPLETED',
        `Recovery test ${testId} ${test.status}`,
        test.status === RecoveryTestStatus.PASSED ? 'INFO' : 'CRITICAL',
      );
    } catch (error) {
      this.logger.error(`Recovery test ${testId} failed:`, error);
      test.status = RecoveryTestStatus.FAILED;
      test.errorMessage = error.message;
      await this.recoveryTestRepository.save(test);

      this.alertingService.sendAlert(
        'RECOVERY_TEST_FAILED',
        `Recovery test ${testId} failed: ${error.message}`,
        'CRITICAL',
      );
    }
  }

  async getTestResults(testId: string): Promise<RecoveryTestResponseDto> {
    const test = await this.recoveryTestRepository.findOne({
      where: { id: testId },
      relations: ['backupRecord'],
    });

    if (!test) {
      throw new NotFoundException(`Recovery test ${testId} not found`);
    }

    return this.toResponseDto(test);
  }

  private async createTestDatabase(dbName: string): Promise<void> {
    const client = new Client({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('DB_PORT', '5432')),
      user: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', ''),
      database: 'postgres',
    });

    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await client.query(`CREATE DATABASE ${dbName}`);
    await client.end();
  }

  private async restoreDatabase(
    dbName: string,
    backupFile: string,
  ): Promise<void> {
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<string>('DB_PORT', '5432');
    const username = this.configService.get<string>('DB_USERNAME', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', '');

    const restoreCommand = `PGPASSWORD="${password}" pg_restore -h ${host} -p ${port} -U ${username} -d ${dbName} ${backupFile}`;

    await execAsync(restoreCommand);
  }

  private async validateRestoredDatabase(dbName: string): Promise<any> {
    const client = new Client({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('DB_PORT', '5432')),
      user: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', ''),
      database: dbName,
    });

    try {
      await client.connect();

      // Run validation queries
      const tableCountResult = await client.query(
        `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const tableCount = parseInt(tableCountResult.rows[0].count);

      await client.end();

      return {
        tableCountMatch: tableCount > 0,
        connectionSuccessful: true,
        queriesExecuted: 1,
      };
    } catch (error) {
      return {
        connectionSuccessful: false,
        errors: [error.message],
      };
    }
  }

  private async dropTestDatabase(dbName: string): Promise<void> {
    const client = new Client({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('DB_PORT', '5432')),
      user: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', ''),
      database: 'postgres',
    });

    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await client.end();
  }

  private toResponseDto(test: RecoveryTest): RecoveryTestResponseDto {
    return {
      id: test.id,
      backupRecordId: test.backupRecordId,
      status: test.status,
      testDatabaseName: test.testDatabaseName,
      validationResults: test.validationResults,
      performanceMetrics: test.performanceMetrics
        ? { totalDuration: test.performanceMetrics.totalDuration }
        : undefined,
      createdAt: test.createdAt,
      testCompletedAt: test.testCompletedAt,
    };
  }
}
