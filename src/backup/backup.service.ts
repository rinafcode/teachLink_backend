import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for backup configuration
 */
export interface BackupConfig {
  /** Directory where backups will be stored */
  backupDir: string;
  /** Encryption key for securing backups */
  encryptionKey: string;
  /** Backup retention period in days */
  retentionDays: number;
  /** Database connection details */
  database: {
    type: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  /** File storage paths to include in backups */
  filePaths: string[];
  /** Regions for backup replication */
  replicationRegions: string[];
}

/**
 * Interface for backup metadata
 */
export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  encrypted: boolean;
  checksums: {
    md5: string;
    sha256: string;
  };
  location: string;
  replicatedTo: string[];
  status: 'pending' | 'completed' | 'failed' | 'verified';
  compressionRatio?: number;
  durationMs?: number;
}

/**
 * Service responsible for managing database and file backups
 * with encryption, scheduling, and retention policies.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private config: BackupConfig;
  private backups: Map<string, BackupMetadata> = new Map();

  constructor() {
    // Load configuration from environment or config service
    this.config = this.loadConfig();
    this.ensureBackupDirectory();
  }

  /**
   * Load backup configuration from environment variables or config service
   */
  private loadConfig(): BackupConfig {
    // In a real implementation, this would load from environment variables or a config service
    return {
      backupDir: process.env.BACKUP_DIR || './backups',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
      database: {
        type: process.env.DB_TYPE || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_DATABASE || 'teachlink',
      },
      filePaths: (process.env.BACKUP_FILE_PATHS || './uploads,./data').split(','),
      replicationRegions: (process.env.BACKUP_REPLICATION_REGIONS || 'us-east-1,eu-west-1').split(','),
    };
  }

  /**
   * Ensure the backup directory exists
   */
  private ensureBackupDirectory(): void {
    try {
      if (!fs.existsSync(this.config.backupDir)) {
        fs.mkdirSync(this.config.backupDir, { recursive: true });
        this.logger.log(`Created backup directory: ${this.config.backupDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create backup directory: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Schedule daily full backups
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleDailyBackup(): Promise<void> {
    try {
      this.logger.log('Starting scheduled daily backup');
      await this.createFullBackup();
      this.logger.log('Completed scheduled daily backup');
    } catch (error) {
      this.logger.error(`Scheduled backup failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Schedule hourly incremental backups
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleHourlyBackup(): Promise<void> {
    try {
      this.logger.log('Starting scheduled hourly incremental backup');
      await this.createIncrementalBackup();
      this.logger.log('Completed scheduled hourly incremental backup');
    } catch (error) {
      this.logger.error(`Scheduled incremental backup failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a full backup of the database and files
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const startTime = Date.now();
    const backupId = `full-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const backupPath = path.join(this.config.backupDir, backupId);
    
    try {
      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });
      
      // Backup database
      const dbBackupPath = path.join(backupPath, 'database.sql');
      await this.backupDatabase(dbBackupPath);
      
      // Backup files
      const filesBackupPath = path.join(backupPath, 'files.tar.gz');
      await this.backupFiles(filesBackupPath);
      
      // Encrypt the backup
      const encryptedDbPath = await this.encryptFile(dbBackupPath);
      const encryptedFilesPath = await this.encryptFile(filesBackupPath);
      
      // Calculate checksums
      const dbChecksum = this.calculateChecksums(encryptedDbPath);
      const filesChecksum = this.calculateChecksums(encryptedFilesPath);
      
      // Create metadata
      const totalSize = fs.statSync(encryptedDbPath).size + fs.statSync(encryptedFilesPath).size;
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'full',
        size: totalSize,
        encrypted: true,
        checksums: {
          md5: dbChecksum.md5 + filesChecksum.md5,
          sha256: dbChecksum.sha256 + filesChecksum.sha256,
        },
        location: backupPath,
        replicatedTo: [],
        status: 'completed',
        durationMs: Date.now() - startTime,
      };
      
      // Store metadata
      this.backups.set(backupId, metadata);
      fs.writeFileSync(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Replicate to other regions
      await this.replicateBackup(backupId);
      
      // Apply retention policy
      await this.applyRetentionPolicy();
      
      this.logger.log(`Full backup completed: ${backupId}`);
      return metadata;
    } catch (error) {
      this.logger.error(`Full backup failed: ${error.message}`, error.stack);
      
      // Create failed metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'full',
        size: 0,
        encrypted: false,
        checksums: {
          md5: '',
          sha256: '',
        },
        location: backupPath,
        replicatedTo: [],
        status: 'failed',
        durationMs: Date.now() - startTime,
      };
      
      this.backups.set(backupId, metadata);
      throw error;
    }
  }

  /**
   * Create an incremental backup based on the latest full backup
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    const startTime = Date.now();
    const backupId = `incremental-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const backupPath = path.join(this.config.backupDir, backupId);
    
    try {
      // Find the latest full backup
      const latestFullBackup = this.findLatestFullBackup();
      if (!latestFullBackup) {
        this.logger.warn('No full backup found. Creating full backup instead.');
        return this.createFullBackup();
      }
      
      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });
      
      // Backup database changes
      const dbBackupPath = path.join(backupPath, 'database-changes.sql');
      await this.backupDatabaseChanges(dbBackupPath, latestFullBackup.timestamp);
      
      // Backup changed files
      const filesBackupPath = path.join(backupPath, 'files-changes.tar.gz');
      await this.backupChangedFiles(filesBackupPath, latestFullBackup.timestamp);
      
      // Encrypt the backup
      const encryptedDbPath = await this.encryptFile(dbBackupPath);
      const encryptedFilesPath = await this.encryptFile(filesBackupPath);
      
      // Calculate checksums
      const dbChecksum = this.calculateChecksums(encryptedDbPath);
      const filesChecksum = this.calculateChecksums(encryptedFilesPath);
      
      // Create metadata
      const totalSize = fs.statSync(encryptedDbPath).size + fs.statSync(encryptedFilesPath).size;
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'incremental',
        size: totalSize,
        encrypted: true,
        checksums: {
          md5: dbChecksum.md5 + filesChecksum.md5,
          sha256: dbChecksum.sha256 + filesChecksum.sha256,
        },
        location: backupPath,
        replicatedTo: [],
        status: 'completed',
        durationMs: Date.now() - startTime,
      };
      
      // Store metadata
      this.backups.set(backupId, metadata);
      fs.writeFileSync(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Replicate to other regions
      await this.replicateBackup(backupId);
      
      this.logger.log(`Incremental backup completed: ${backupId}`);
      return metadata;
    } catch (error) {
      this.logger.error(`Incremental backup failed: ${error.message}`, error.stack);
      
      // Create failed metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'incremental',
        size: 0,
        encrypted: false,
        checksums: {
          md5: '',
          sha256: '',
        },
        location: backupPath,
        replicatedTo: [],
        status: 'failed',
        durationMs: Date.now() - startTime,
      };
      
      this.backups.set(backupId, metadata);
      throw error;
    }
  }

  /**
   * Find the latest full backup
   */
  private findLatestFullBackup(): BackupMetadata | null {
    let latestBackup: BackupMetadata | null = null;
    let latestTimestamp = 0;
    
    for (const backup of this.backups.values()) {
      if (backup.type === 'full' && backup.status === 'completed') {
        const timestamp = backup.timestamp.getTime();
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestBackup = backup;
        }
      }
    }
    
    return latestBackup;
  }

  /**
   * Backup the database to a file
   * @param outputPath Path to save the database backup
   */
  private async backupDatabase(outputPath: string): Promise<void> {
    // In a real implementation, this would use the appropriate database client
    // to create a backup (e.g., pg_dump for PostgreSQL)
    this.logger.log(`Backing up database to ${outputPath}`);
    
    // Simulate database backup
    fs.writeFileSync(outputPath, `-- Database backup simulation\n-- Generated at ${new Date().toISOString()}`);
  }

  /**
   * Backup database changes since a specific date
   * @param outputPath Path to save the database changes
   * @param sinceDate Only include changes since this date
   */
  private async backupDatabaseChanges(outputPath: string, sinceDate: Date): Promise<void> {
    // In a real implementation, this would use the database WAL (Write-Ahead Log)
    // or transaction logs to extract changes since the specified date
    this.logger.log(`Backing up database changes since ${sinceDate.toISOString()} to ${outputPath}`);
    
    // Simulate database changes backup
    fs.writeFileSync(
      outputPath,
      `-- Database changes backup simulation\n-- Changes since ${sinceDate.toISOString()}\n-- Generated at ${new Date().toISOString()}`
    );
  }

  /**
   * Backup files to a compressed archive
   * @param outputPath Path to save the compressed file backup
   */
  private async backupFiles(outputPath: string): Promise<void> {
    // In a real implementation, this would use a library like tar-fs to create
    // a compressed archive of the specified files
    this.logger.log(`Backing up files to ${outputPath}`);
    
    // Simulate file backup
    fs.writeFileSync(outputPath, `File backup simulation generated at ${new Date().toISOString()}`);
  }

  /**
   * Backup changed files since a specific date
   * @param outputPath Path to save the compressed changed files
   * @param sinceDate Only include files changed since this date
   */
  private async backupChangedFiles(outputPath: string, sinceDate: Date): Promise<void> {
    // In a real implementation, this would scan the file directories and only
    // include files that have been modified since the specified date
    this.logger.log(`Backing up changed files since ${sinceDate.toISOString()} to ${outputPath}`);
    
    // Simulate changed files backup
    fs.writeFileSync(
      outputPath,
      `Changed files backup simulation\nChanges since ${sinceDate.toISOString()}\nGenerated at ${new Date().toISOString()}`
    );
  }

  /**
   * Encrypt a file using AES-256-CBC
   * @param filePath Path to the file to encrypt
   * @returns Path to the encrypted file
   */
  private async encryptFile(filePath: string): Promise<string> {
    const encryptedPath = `${filePath}.enc`;
    
    try {
      // Read the file
      const fileData = fs.readFileSync(filePath);
      
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher using the encryption key and IV
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Encrypt the file
      const encrypted = Buffer.concat([
        iv,
        cipher.update(fileData),
        cipher.final(),
      ]);
      
      // Write the encrypted file
      fs.writeFileSync(encryptedPath, encrypted);
      
      // Delete the original file
      fs.unlinkSync(filePath);
      
      this.logger.log(`Encrypted file ${filePath} to ${encryptedPath}`);
      return encryptedPath;
    } catch (error) {
      this.logger.error(`File encryption failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Decrypt a file that was encrypted with encryptFile
   * @param encryptedPath Path to the encrypted file
   * @returns Path to the decrypted file
   */
  async decryptFile(encryptedPath: string): Promise<string> {
    const decryptedPath = encryptedPath.replace(/\.enc$/, '');
    
    try {
      // Read the encrypted file
      const encryptedData = fs.readFileSync(encryptedPath);
      
      // Extract the IV from the first 16 bytes
      const iv = encryptedData.slice(0, 16);
      const encryptedContent = encryptedData.slice(16);
      
      // Create decipher using the encryption key and IV
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Decrypt the file
      const decrypted = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
      ]);
      
      // Write the decrypted file
      fs.writeFileSync(decryptedPath, decrypted);
      
      this.logger.log(`Decrypted file ${encryptedPath} to ${decryptedPath}`);
      return decryptedPath;
    } catch (error) {
      this.logger.error(`File decryption failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate MD5 and SHA-256 checksums for a file
   * @param filePath Path to the file
   * @returns Object containing MD5 and SHA-256 checksums
   */
  private calculateChecksums(filePath: string): { md5: string; sha256: string } {
    try {
      const fileData = fs.readFileSync(filePath);
      
      const md5 = crypto.createHash('md5').update(fileData).digest('hex');
      const sha256 = crypto.createHash('sha256').update(fileData).digest('hex');
      
      return { md5, sha256 };
    } catch (error) {
      this.logger.error(`Checksum calculation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Replicate a backup to other regions
   * @param backupId ID of the backup to replicate
   */
  private async replicateBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    this.logger.log(`Replicating backup ${backupId} to regions: ${this.config.replicationRegions.join(', ')}`);
    
    // In a real implementation, this would use a cloud storage SDK to copy the backup
    // to other regions (e.g., AWS S3 cross-region replication)
    
    // Simulate replication
    for (const region of this.config.replicationRegions) {
      this.logger.log(`Replicating to region: ${region}`);
      
      // Update backup metadata with replication status
      backup.replicatedTo.push(region);
    }
    
    // Update the stored metadata
    this.backups.set(backupId, backup);
    fs.writeFileSync(
      path.join(backup.location, 'metadata.json'),
      JSON.stringify(backup, null, 2)
    );
  }

  /**
   * Apply retention policy to remove old backups
   */
  private async applyRetentionPolicy(): Promise<void> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);
    
    this.logger.log(`Applying retention policy: removing backups older than ${retentionDate.toISOString()}`);
    
    const backupsToRemove: string[] = [];
    
    // Find backups older than the retention date
    for (const [backupId, backup] of this.backups.entries()) {
      if (backup.timestamp < retentionDate) {
        backupsToRemove.push(backupId);
      }
    }
    
    // Remove old backups
    for (const backupId of backupsToRemove) {
      await this.removeBackup(backupId);
    }
    
    this.logger.log(`Removed ${backupsToRemove.length} backups due to retention policy`);
  }

  /**
   * Remove a backup and its files
   * @param backupId ID of the backup to remove
   */
  private async removeBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      return;
    }
    
    try {
      // Remove backup files
      if (fs.existsSync(backup.location)) {
        fs.rmSync(backup.location, { recursive: true, force: true });
      }
      
      // Remove from backups map
      this.backups.delete(backupId);
      
      this.logger.log(`Removed backup ${backupId}`);
    } catch (error) {
      this.logger.error(`Failed to remove backup ${backupId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Get all backups
   */
  getAllBackups(): BackupMetadata[] {
    return Array.from(this.backups.values());
  }

  /**
   * Get a specific backup by ID
   * @param backupId ID of the backup to retrieve
   */
  getBackup(backupId: string): BackupMetadata | undefined {
    return this.backups.get(backupId);
  }

  /**
   * Restore a backup
   * @param backupId ID of the backup to restore
   */
  async restoreBackup(backupId: string): Promise<boolean> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    if (backup.status !== 'completed' && backup.status !== 'verified') {
      throw new Error(`Cannot restore backup ${backupId} with status ${backup.status}`);
    }
    
    this.logger.log(`Starting restoration of backup ${backupId}`);
    
    try {
      // In a real implementation, this would:
      // 1. Decrypt the backup files
      // 2. Restore the database from the backup
      // 3. Restore the files from the backup
      
      // Simulate restoration
      this.logger.log(`Restored backup ${backupId}`);
      return true;
    } catch (error) {
      this.logger.error(`Backup restoration failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}