import { Injectable, Logger } from '@nestjs/common';
import { BackupService } from '../backup.service';
import { DisasterRecoveryService } from '../disaster-recovery/disaster-recovery.service';
import { DataIntegrityService } from '../integrity/data-integrity.service';
import { RecoveryTestingService } from '../testing/recovery-testing.service';
import { BackupMonitoringService } from '../monitoring/backup-monitoring.service';

/**
 * Service responsible for integrating backup and disaster recovery
 * functionality with other modules in the application.
 */
@Injectable()
export class BackupIntegrationService {
  private readonly logger = new Logger(BackupIntegrationService.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly disasterRecoveryService: DisasterRecoveryService,
    private readonly dataIntegrityService: DataIntegrityService,
    private readonly recoveryTestingService: RecoveryTestingService,
    private readonly backupMonitoringService: BackupMonitoringService,
  ) {}

  /**
   * Initialize backup services for a specific module
   * @param moduleName Name of the module to initialize backups for
   */
  async initializeBackupsForModule(moduleName: string): Promise<void> {
    this.logger.log(`Initializing backup services for module: ${moduleName}`);
    
    // Register module with backup service
    await this.backupService.registerModuleForBackup(moduleName);
    
    // Schedule regular integrity checks for this module's backups
    await this.dataIntegrityService.scheduleIntegrityChecksForModule(moduleName);
    
    this.logger.log(`Backup services initialized for module: ${moduleName}`);
  }

  /**
   * Trigger a backup for a specific module
   * @param moduleName Name of the module to backup
   * @param isFullBackup Whether to perform a full backup (true) or incremental (false)
   */
  async backupModule(moduleName: string, isFullBackup = false): Promise<string> {
    this.logger.log(`Triggering ${isFullBackup ? 'full' : 'incremental'} backup for module: ${moduleName}`);
    
    try {
      const backupId = isFullBackup
        ? await this.backupService.createFullBackup([moduleName])
        : await this.backupService.createIncrementalBackup([moduleName]);
      
      this.logger.log(`Backup completed for module ${moduleName}, backup ID: ${backupId}`);
      return backupId;
    } catch (error) {
      this.logger.error(`Backup failed for module ${moduleName}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Restore a specific module from backup
   * @param moduleName Name of the module to restore
   * @param backupId ID of the backup to restore from (optional, uses latest if not provided)
   */
  async restoreModule(moduleName: string, backupId?: string): Promise<boolean> {
    try {
      // If no backup ID provided, find the latest verified backup for this module
      if (!backupId) {
        const latestBackup = await this.findLatestVerifiedBackupForModule(moduleName);
        if (!latestBackup) {
          throw new Error(`No verified backups found for module: ${moduleName}`);
        }
        backupId = latestBackup;
      }
      
      this.logger.log(`Restoring module ${moduleName} from backup: ${backupId}`);
      
      // Perform the restore operation
      await this.backupService.restoreBackup(backupId, null, [moduleName]);
      
      this.logger.log(`Module ${moduleName} successfully restored from backup: ${backupId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to restore module ${moduleName}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find the latest verified backup for a specific module
   * @param moduleName Name of the module
   */
  private async findLatestVerifiedBackupForModule(moduleName: string): Promise<string | null> {
    // Get all backups for this module
    const allBackups = this.backupService.getAllBackups()
      .filter(backup => backup.modules.includes(moduleName))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Find the latest verified backup
    for (const backup of allBackups) {
      const verificationResult = await this.dataIntegrityService.verifyBackup(backup.id, false);
      if (verificationResult.verified) {
        return backup.id;
      }
    }
    
    return null;
  }

  /**
   * Register critical data for priority backup and recovery
   * @param dataType Type of data (e.g., 'user', 'course', 'assessment')
   * @param priority Priority level (1-5, where 1 is highest)
   */
  registerCriticalData(dataType: string, priority: number): void {
    this.logger.log(`Registering critical data type: ${dataType} with priority: ${priority}`);
    this.backupService.registerCriticalData(dataType, priority);
  }

  /**
   * Get backup statistics for a specific module
   * @param moduleName Name of the module
   */
  getModuleBackupStats(moduleName: string): any {
    const allBackups = this.backupService.getAllBackups()
      .filter(backup => backup.modules.includes(moduleName));
    
    const totalBackups = allBackups.length;
    const fullBackups = allBackups.filter(b => b.type === 'full').length;
    const incrementalBackups = allBackups.filter(b => b.type === 'incremental').length;
    
    // Calculate average backup size
    const totalSize = allBackups.reduce((sum, backup) => sum + backup.size, 0);
    const averageSize = totalBackups > 0 ? totalSize / totalBackups : 0;
    
    // Get latest backup info
    let latestBackup = null;
    if (totalBackups > 0) {
      const latest = allBackups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      latestBackup = {
        id: latest.id,
        timestamp: latest.timestamp,
        type: latest.type,
        size: latest.size,
      };
    }
    
    return {
      moduleName,
      totalBackups,
      fullBackups,
      incrementalBackups,
      averageSize,
      latestBackup,
    };
  }

  /**
   * Check if a module's data is protected by the backup system
   * @param moduleName Name of the module
   */
  isModuleProtected(moduleName: string): boolean {
    const registeredModules = this.backupService.getRegisteredModules();
    return registeredModules.includes(moduleName);
  }

  /**
   * Get disaster recovery readiness status for the application
   */
  getDisasterRecoveryReadiness(): any {
    // Get region health information
    const regionHealth = this.disasterRecoveryService.getAllRegionHealth();
    
    // Get RTO/RPO compliance
    const rtoCompliance = this.backupMonitoringService.getCurrentMetrics().rto.compliance;
    const rpoCompliance = this.backupMonitoringService.getCurrentMetrics().rpo.compliance;
    
    // Get latest recovery test results
    const testResults = this.recoveryTestingService.getAllTestResults()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    const latestTest = testResults.length > 0 ? testResults[0] : null;
    
    // Calculate overall readiness score (0-100)
    let readinessScore = 0;
    
    // Factor 1: Healthy regions (30% of score)
    const healthyRegions = regionHealth.filter(r => r.status === 'healthy').length;
    const totalRegions = regionHealth.length;
    const regionScore = totalRegions > 0 ? (healthyRegions / totalRegions) * 30 : 0;
    
    // Factor 2: RTO/RPO compliance (40% of score)
    const complianceScore = ((rtoCompliance + rpoCompliance) / 2) * 0.4;
    
    // Factor 3: Recent successful test (30% of score)
    let testScore = 0;
    if (latestTest) {
      // If test was successful and within last 7 days
      const daysSinceTest = (new Date().getTime() - latestTest.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      if (latestTest.success && daysSinceTest <= 7) {
        testScore = 30;
      } else if (latestTest.success && daysSinceTest <= 30) {
        // Successful but older
        testScore = 15;
      } else if (!latestTest.success && daysSinceTest <= 7) {
        // Recent but failed
        testScore = 5;
      }
    }
    
    readinessScore = regionScore + complianceScore + testScore;
    
    // Determine readiness level
    let readinessLevel = 'critical';
    if (readinessScore >= 90) readinessLevel = 'excellent';
    else if (readinessScore >= 75) readinessLevel = 'good';
    else if (readinessScore >= 50) readinessLevel = 'fair';
    else if (readinessScore >= 25) readinessLevel = 'poor';
    
    return {
      readinessScore,
      readinessLevel,
      regionHealth: {
        total: totalRegions,
        healthy: healthyRegions,
        unhealthy: totalRegions - healthyRegions,
      },
      compliance: {
        rto: rtoCompliance,
        rpo: rpoCompliance,
      },
      latestTest: latestTest ? {
        timestamp: latestTest.timestamp,
        success: latestTest.success,
        recoveryTime: latestTest.recoveryTime,
      } : null,
      recommendations: this.generateReadinessRecommendations(readinessScore, regionHealth, rtoCompliance, rpoCompliance, latestTest),
    };
  }

  /**
   * Generate recommendations to improve disaster recovery readiness
   */
  private generateReadinessRecommendations(
    readinessScore: number,
    regionHealth: any[],
    rtoCompliance: number,
    rpoCompliance: number,
    latestTest: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Region health recommendations
    const unhealthyRegions = regionHealth.filter(r => r.status !== 'healthy');
    if (unhealthyRegions.length > 0) {
      recommendations.push(`Address health issues in ${unhealthyRegions.length} region(s): ${unhealthyRegions.map(r => r.name).join(', ')}`);
    }
    
    if (regionHealth.length < 2) {
      recommendations.push('Configure at least one additional backup region for disaster recovery');
    }
    
    // RTO/RPO recommendations
    if (rtoCompliance < 100) {
      recommendations.push('Optimize recovery procedures to improve RTO compliance');
    }
    
    if (rpoCompliance < 100) {
      recommendations.push('Increase backup frequency to improve RPO compliance');
    }
    
    // Testing recommendations
    if (!latestTest) {
      recommendations.push('Run a disaster recovery test as soon as possible');
    } else {
      const daysSinceTest = (new Date().getTime() - latestTest.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      
      if (!latestTest.success) {
        recommendations.push('Address issues from the failed recovery test and run a new test');
      } else if (daysSinceTest > 30) {
        recommendations.push('Run a new disaster recovery test (last successful test was over 30 days ago)');
      }
    }
    
    // General recommendations based on score
    if (readinessScore < 50) {
      recommendations.push('Develop a comprehensive disaster recovery plan and implement regular testing');
    }
    
    return recommendations;
  }
}