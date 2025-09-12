import { Controller, Get, Post, Body, Param, Query, Delete, Put, UseGuards } from '@nestjs/common';
import { BackupService } from '../backup.service';
import { DisasterRecoveryService } from '../disaster-recovery/disaster-recovery.service';
import { DataIntegrityService } from '../integrity/data-integrity.service';
import { RecoveryTestingService } from '../testing/recovery-testing.service';
import { BackupMonitoringService } from '../monitoring/backup-monitoring.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

/**
 * Controller for backup and disaster recovery operations
 */
@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly disasterRecoveryService: DisasterRecoveryService,
    private readonly dataIntegrityService: DataIntegrityService,
    private readonly recoveryTestingService: RecoveryTestingService,
    private readonly backupMonitoringService: BackupMonitoringService,
  ) {}

  /**
   * Get all backups
   */
  @Get('backups')
  @Roles('admin')
  getAllBackups() {
    return this.backupService.getAllBackups();
  }

  /**
   * Get backup by ID
   */
  @Get('backups/:id')
  @Roles('admin')
  getBackupById(@Param('id') id: string) {
    return this.backupService.getBackupMetadata(id);
  }

  /**
   * Trigger a full backup
   */
  @Post('backups/full')
  @Roles('admin')
  createFullBackup() {
    return this.backupService.createFullBackup();
  }

  /**
   * Trigger an incremental backup
   */
  @Post('backups/incremental')
  @Roles('admin')
  createIncrementalBackup() {
    return this.backupService.createIncrementalBackup();
  }

  /**
   * Restore from a backup
   */
  @Post('backups/:id/restore')
  @Roles('admin')
  restoreBackup(
    @Param('id') id: string,
    @Body() options: { targetEnvironment?: string }
  ) {
    return this.backupService.restoreBackup(id, options.targetEnvironment);
  }

  /**
   * Delete a backup
   */
  @Delete('backups/:id')
  @Roles('admin')
  deleteBackup(@Param('id') id: string) {
    return this.backupService.removeBackup(id);
  }

  /**
   * Get region health status
   */
  @Get('disaster-recovery/regions')
  @Roles('admin')
  getRegionHealth() {
    return this.disasterRecoveryService.getAllRegionHealth();
  }

  /**
   * Get current active region
   */
  @Get('disaster-recovery/active-region')
  @Roles('admin')
  getActiveRegion() {
    return this.disasterRecoveryService.getCurrentActiveRegion();
  }

  /**
   * Trigger manual failover to another region
   */
  @Post('disaster-recovery/failover')
  @Roles('admin')
  triggerFailover(@Body() options: { targetRegion: string }) {
    return this.disasterRecoveryService.triggerManualFailover(options.targetRegion);
  }

  /**
   * Trigger failback to primary region
   */
  @Post('disaster-recovery/failback')
  @Roles('admin')
  triggerFailback() {
    return this.disasterRecoveryService.triggerManualFailback();
  }

  /**
   * Get failover history
   */
  @Get('disaster-recovery/history')
  @Roles('admin')
  getFailoverHistory() {
    return this.disasterRecoveryService.getFailoverHistory();
  }

  /**
   * Run a disaster recovery drill
   */
  @Post('disaster-recovery/drill')
  @Roles('admin')
  runDisasterRecoveryDrill(@Body() options: { targetRegion: string }) {
    return this.disasterRecoveryService.runDisasterRecoveryDrill(options.targetRegion);
  }

  /**
   * Verify backup integrity
   */
  @Post('integrity/verify/:id')
  @Roles('admin')
  verifyBackupIntegrity(@Param('id') id: string) {
    return this.dataIntegrityService.verifyBackup(id);
  }

  /**
   * Get all integrity verification results
   */
  @Get('integrity/results')
  @Roles('admin')
  getIntegrityResults() {
    return this.dataIntegrityService.getAllVerificationResults();
  }

  /**
   * Get corrupted backups
   */
  @Get('integrity/corrupted')
  @Roles('admin')
  getCorruptedBackups() {
    return this.dataIntegrityService.getCorruptedBackups();
  }

  /**
   * Generate integrity report
   */
  @Get('integrity/report')
  @Roles('admin')
  generateIntegrityReport() {
    return this.dataIntegrityService.generateIntegrityReport();
  }

  /**
   * Run automated recovery test
   */
  @Post('testing/automated')
  @Roles('admin')
  runAutomatedRecoveryTest() {
    return this.recoveryTestingService.runAutomatedRecoveryTest();
  }

  /**
   * Run manual recovery test
   */
  @Post('testing/manual')
  @Roles('admin')
  runManualRecoveryTest(
    @Body() options: { backupId: string; testType: string }
  ) {
    return this.recoveryTestingService.runManualRecoveryTest(
      options.backupId,
      options.testType
    );
  }

  /**
   * Get all recovery test results
   */
  @Get('testing/results')
  @Roles('admin')
  getRecoveryTestResults() {
    return this.recoveryTestingService.getAllTestResults();
  }

  /**
   * Generate recovery testing report
   */
  @Get('testing/report')
  @Roles('admin')
  generateRecoveryTestingReport() {
    return this.recoveryTestingService.generateRecoveryTestingReport();
  }

  /**
   * Get current monitoring metrics
   */
  @Get('monitoring/metrics')
  @Roles('admin')
  getCurrentMetrics() {
    return this.backupMonitoringService.getCurrentMetrics();
  }

  /**
   * Get metrics history
   */
  @Get('monitoring/history')
  @Roles('admin')
  getMetricsHistory() {
    return this.backupMonitoringService.getMetricsHistory();
  }

  /**
   * Get active alerts
   */
  @Get('monitoring/alerts')
  @Roles('admin')
  getActiveAlerts() {
    return this.backupMonitoringService.getActiveAlerts();
  }

  /**
   * Resolve an alert
   */
  @Put('monitoring/alerts/:id/resolve')
  @Roles('admin')
  resolveAlert(@Param('id') id: string) {
    return this.backupMonitoringService.resolveAlert(id);
  }

  /**
   * Generate monitoring dashboard
   */
  @Get('monitoring/dashboard')
  @Roles('admin')
  generateMonitoringDashboard() {
    return this.backupMonitoringService.generateMonitoringDashboard();
  }
}