import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BackupService, BackupMetadata } from '../backup.service';

/**
 * Interface for integrity verification result
 */
export interface IntegrityVerificationResult {
  backupId: string;
  timestamp: Date;
  verified: boolean;
  errors: string[];
  checksumMatch: boolean;
  encryptionValid: boolean;
  restoreTestPassed: boolean;
  corruptedFiles: string[];
  verificationDurationMs: number;
}

/**
 * Interface for data integrity configuration
 */
export interface DataIntegrityConfig {
  /** How often to verify backups (percentage of backups to check) */
  verificationPercentage: number;
  /** Whether to perform restore tests during verification */
  performRestoreTests: boolean;
  /** Directory for temporary restore tests */
  restoreTestDir: string;
  /** Maximum number of verification errors before alerting */
  maxErrorsBeforeAlert: number;
  /** Whether to automatically repair corrupted backups when possible */
  autoRepairCorrupted: boolean;
}

/**
 * Service responsible for verifying the integrity of backups
 * and ensuring data can be successfully restored.
 */
@Injectable()
export class DataIntegrityService {
  private readonly logger = new Logger(DataIntegrityService.name);
  private config: DataIntegrityConfig;
  private verificationResults: Map<string, IntegrityVerificationResult> = new Map();
  private corruptedBackups: Set<string> = new Set();

  constructor(private readonly backupService: BackupService) {
    this.config = this.loadConfig();
    this.ensureRestoreTestDirectory();
  }

  /**
   * Load data integrity configuration
   */
  private loadConfig(): DataIntegrityConfig {
    // In a real implementation, this would load from environment variables or a config service
    return {
      verificationPercentage: parseInt(process.env.INTEGRITY_VERIFICATION_PERCENTAGE || '20', 10),
      performRestoreTests: process.env.INTEGRITY_PERFORM_RESTORE_TESTS === 'true',
      restoreTestDir: process.env.INTEGRITY_RESTORE_TEST_DIR || './restore-tests',
      maxErrorsBeforeAlert: parseInt(process.env.INTEGRITY_MAX_ERRORS_BEFORE_ALERT || '3', 10),
      autoRepairCorrupted: process.env.INTEGRITY_AUTO_REPAIR_CORRUPTED === 'true',
    };
  }

  /**
   * Ensure the restore test directory exists
   */
  private ensureRestoreTestDirectory(): void {
    if (this.config.performRestoreTests) {
      try {
        if (!fs.existsSync(this.config.restoreTestDir)) {
          fs.mkdirSync(this.config.restoreTestDir, { recursive: true });
          this.logger.log(`Created restore test directory: ${this.config.restoreTestDir}`);
        }
      } catch (error) {
        this.logger.error(`Failed to create restore test directory: ${error.message}`, error.stack);
      }
    }
  }

  /**
   * Schedule regular integrity checks for backups
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduleIntegrityChecks(): Promise<void> {
    try {
      this.logger.log('Starting scheduled backup integrity checks');
      await this.verifyRandomBackups();
      this.logger.log('Completed scheduled backup integrity checks');
    } catch (error) {
      this.logger.error(`Scheduled integrity checks failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Verify a random sample of backups based on the verification percentage
   */
  async verifyRandomBackups(): Promise<IntegrityVerificationResult[]> {
    const allBackups = this.backupService.getAllBackups();
    const completedBackups = allBackups.filter(backup => 
      backup.status === 'completed' || backup.status === 'verified'
    );
    
    if (completedBackups.length === 0) {
      this.logger.log('No completed backups to verify');
      return [];
    }
    
    // Calculate how many backups to verify
    const backupsToVerifyCount = Math.max(
      1,
      Math.ceil(completedBackups.length * (this.config.verificationPercentage / 100))
    );
    
    // Randomly select backups to verify
    const backupsToVerify = this.getRandomBackups(completedBackups, backupsToVerifyCount);
    
    this.logger.log(`Verifying ${backupsToVerify.length} out of ${completedBackups.length} backups`);
    
    const results: IntegrityVerificationResult[] = [];
    
    for (const backup of backupsToVerify) {
      const result = await this.verifyBackupIntegrity(backup.id);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Get a random sample of backups
   * @param backups Array of backups to sample from
   * @param count Number of backups to select
   */
  private getRandomBackups(backups: BackupMetadata[], count: number): BackupMetadata[] {
    // Shuffle the array using Fisher-Yates algorithm
    const shuffled = [...backups];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Take the first 'count' elements
    return shuffled.slice(0, count);
  }

  /**
   * Verify the integrity of a specific backup
   * @param backupId ID of the backup to verify
   */
  async verifyBackupIntegrity(backupId: string): Promise<IntegrityVerificationResult> {
    const startTime = Date.now();
    const backup = this.backupService.getBackup(backupId);
    
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    this.logger.log(`Verifying integrity of backup ${backupId}`);
    
    const result: IntegrityVerificationResult = {
      backupId,
      timestamp: new Date(),
      verified: false,
      errors: [],
      checksumMatch: false,
      encryptionValid: false,
      restoreTestPassed: false,
      corruptedFiles: [],
      verificationDurationMs: 0,
    };
    
    try {
      // Verify backup exists
      if (!fs.existsSync(backup.location)) {
        result.errors.push(`Backup location does not exist: ${backup.location}`);
        this.handleCorruptedBackup(backupId, result);
        return this.finalizeVerificationResult(result, startTime);
      }
      
      // Verify metadata file exists
      const metadataPath = path.join(backup.location, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        result.errors.push(`Metadata file does not exist: ${metadataPath}`);
        this.handleCorruptedBackup(backupId, result);
        return this.finalizeVerificationResult(result, startTime);
      }
      
      // Verify checksums
      result.checksumMatch = await this.verifyChecksums(backup);
      if (!result.checksumMatch) {
        result.errors.push('Checksum verification failed');
      }
      
      // Verify encryption
      result.encryptionValid = await this.verifyEncryption(backup);
      if (!result.encryptionValid) {
        result.errors.push('Encryption verification failed');
      }
      
      // Perform restore test if configured
      if (this.config.performRestoreTests) {
        result.restoreTestPassed = await this.performRestoreTest(backup);
        if (!result.restoreTestPassed) {
          result.errors.push('Restore test failed');
        }
      } else {
        // Skip restore test
        result.restoreTestPassed = true;
      }
      
      // If any verification failed, handle as corrupted
      if (result.errors.length > 0) {
        this.handleCorruptedBackup(backupId, result);
      } else {
        // All verifications passed
        result.verified = true;
        
        // Update backup status to verified
        if (backup.status === 'completed') {
          // In a real implementation, this would update the backup status in the database
          backup.status = 'verified';
          this.logger.log(`Backup ${backupId} verified successfully`);
        }
      }
    } catch (error) {
      result.errors.push(`Verification error: ${error.message}`);
      this.handleCorruptedBackup(backupId, result);
    }
    
    return this.finalizeVerificationResult(result, startTime);
  }

  /**
   * Finalize the verification result by calculating duration and storing the result
   * @param result Verification result to finalize
   * @param startTime Start time of the verification
   */
  private finalizeVerificationResult(
    result: IntegrityVerificationResult,
    startTime: number
  ): IntegrityVerificationResult {
    result.verificationDurationMs = Date.now() - startTime;
    this.verificationResults.set(result.backupId, result);
    
    return result;
  }

  /**
   * Verify checksums of backup files
   * @param backup Backup to verify checksums for
   */
  private async verifyChecksums(backup: BackupMetadata): Promise<boolean> {
    try {
      this.logger.log(`Verifying checksums for backup ${backup.id}`);
      
      // In a real implementation, this would:
      // 1. Read all files in the backup
      // 2. Calculate checksums for each file
      // 3. Compare with the checksums stored in the metadata
      
      // For simulation, we'll return true most of the time
      const simulateFailure = Math.random() < 0.05; // 5% chance of failure
      
      if (simulateFailure) {
        this.logger.warn(`Simulated checksum verification failure for backup ${backup.id}`);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Checksum verification failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Verify encryption of backup files
   * @param backup Backup to verify encryption for
   */
  private async verifyEncryption(backup: BackupMetadata): Promise<boolean> {
    try {
      this.logger.log(`Verifying encryption for backup ${backup.id}`);
      
      // In a real implementation, this would:
      // 1. Attempt to decrypt a small portion of each encrypted file
      // 2. Verify the decryption was successful
      
      // For simulation, we'll return true most of the time
      const simulateFailure = Math.random() < 0.03; // 3% chance of failure
      
      if (simulateFailure) {
        this.logger.warn(`Simulated encryption verification failure for backup ${backup.id}`);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Encryption verification failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Perform a restore test for a backup
   * @param backup Backup to test restore for
   */
  private async performRestoreTest(backup: BackupMetadata): Promise<boolean> {
    try {
      this.logger.log(`Performing restore test for backup ${backup.id}`);
      
      // Create a unique directory for this restore test
      const restoreDir = path.join(
        this.config.restoreTestDir,
        `restore-test-${backup.id}-${Date.now()}`
      );
      
      if (!fs.existsSync(restoreDir)) {
        fs.mkdirSync(restoreDir, { recursive: true });
      }
      
      // In a real implementation, this would:
      // 1. Restore a small subset of the backup to the test directory
      // 2. Verify the restored files are valid
      // 3. Clean up the test directory
      
      // For simulation, we'll return true most of the time
      const simulateFailure = Math.random() < 0.07; // 7% chance of failure
      
      if (simulateFailure) {
        this.logger.warn(`Simulated restore test failure for backup ${backup.id}`);
        return false;
      }
      
      // Clean up the test directory
      if (fs.existsSync(restoreDir)) {
        fs.rmSync(restoreDir, { recursive: true, force: true });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Restore test failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Handle a corrupted backup
   * @param backupId ID of the corrupted backup
   * @param result Verification result
   */
  private handleCorruptedBackup(backupId: string, result: IntegrityVerificationResult): void {
    this.logger.warn(`Backup ${backupId} is corrupted: ${result.errors.join(', ')}`);
    
    // Add to corrupted backups set
    this.corruptedBackups.add(backupId);
    
    // Check if we should alert
    if (this.corruptedBackups.size >= this.config.maxErrorsBeforeAlert) {
      this.triggerCorruptionAlert();
    }
    
    // Attempt to repair if configured
    if (this.config.autoRepairCorrupted) {
      this.attemptBackupRepair(backupId);
    }
  }

  /**
   * Trigger an alert for corrupted backups
   */
  private triggerCorruptionAlert(): void {
    this.logger.error(
      `ALERT: ${this.corruptedBackups.size} corrupted backups detected, exceeding threshold of ${this.config.maxErrorsBeforeAlert}`
    );
    
    // In a real implementation, this would send an alert via email, SMS, or a monitoring system
  }

  /**
   * Attempt to repair a corrupted backup
   * @param backupId ID of the backup to repair
   */
  private async attemptBackupRepair(backupId: string): Promise<boolean> {
    try {
      this.logger.log(`Attempting to repair corrupted backup ${backupId}`);
      
      // In a real implementation, this would:
      // 1. Identify which files are corrupted
      // 2. Attempt to restore them from replicated backups
      // 3. Update checksums and metadata
      
      // For simulation, we'll return true sometimes
      const repairSuccessful = Math.random() < 0.6; // 60% chance of successful repair
      
      if (repairSuccessful) {
        this.logger.log(`Successfully repaired backup ${backupId}`);
        this.corruptedBackups.delete(backupId);
      } else {
        this.logger.warn(`Failed to repair backup ${backupId}`);
      }
      
      return repairSuccessful;
    } catch (error) {
      this.logger.error(`Backup repair failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get all verification results
   */
  getAllVerificationResults(): IntegrityVerificationResult[] {
    return Array.from(this.verificationResults.values());
  }

  /**
   * Get a specific verification result by backup ID
   * @param backupId ID of the backup
   */
  getVerificationResult(backupId: string): IntegrityVerificationResult | undefined {
    return this.verificationResults.get(backupId);
  }

  /**
   * Get all corrupted backups
   */
  getCorruptedBackups(): string[] {
    return Array.from(this.corruptedBackups);
  }

  /**
   * Generate an integrity report
   */
  generateIntegrityReport(): any {
    const allResults = this.getAllVerificationResults();
    const recentResults = allResults.filter(
      result => result.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );
    
    const totalBackups = this.backupService.getAllBackups().length;
    const verifiedBackups = allResults.filter(result => result.verified).length;
    const corruptedBackups = this.corruptedBackups.size;
    
    return {
      timestamp: new Date(),
      totalBackups,
      verifiedBackups,
      corruptedBackups,
      verificationRate: totalBackups > 0 ? (verifiedBackups / totalBackups) * 100 : 0,
      corruptionRate: totalBackups > 0 ? (corruptedBackups / totalBackups) * 100 : 0,
      recentVerifications: recentResults.length,
      recentFailures: recentResults.filter(result => !result.verified).length,
      commonErrors: this.getCommonErrors(allResults),
      integrityStatus: corruptedBackups > this.config.maxErrorsBeforeAlert ? 'critical' : 'healthy',
    };
  }

  /**
   * Get common errors from verification results
   * @param results Verification results to analyze
   */
  private getCommonErrors(results: IntegrityVerificationResult[]): Record<string, number> {
    const errorCounts: Record<string, number> = {};
    
    for (const result of results) {
      for (const error of result.errors) {
        // Extract the error type (everything before the first colon or the whole string)
        const errorType = error.split(':')[0] || error;
        
        errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
      }
    }
    
    return errorCounts;
  }
}