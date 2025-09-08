import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupService, BackupMetadata } from '../backup.service';
import { DisasterRecoveryService } from '../disaster-recovery/disaster-recovery.service';
import { DataIntegrityService } from '../integrity/data-integrity.service';
import { RecoveryTestingService } from '../testing/recovery-testing.service';

/**
 * Interface for monitoring configuration
 */
export interface MonitoringConfig {
  /** Alert thresholds for backup success rate */
  backupSuccessRateThreshold: number;
  /** Alert threshold for backup age (in hours) */
  backupAgeThresholdHours: number;
  /** Alert threshold for RTO compliance (percentage above target) */
  rtoComplianceThreshold: number;
  /** Alert threshold for RPO compliance (percentage above target) */
  rpoComplianceThreshold: number;
  /** Whether to send alerts for threshold violations */
  enableAlerts: boolean;
  /** Notification channels for alerts */
  alertChannels: ('email' | 'sms' | 'slack' | 'webhook')[];
  /** Recipients for email alerts */
  emailRecipients?: string[];
  /** Webhook URL for alerts */
  webhookUrl?: string;
}

/**
 * Interface for monitoring metrics
 */
export interface MonitoringMetrics {
  timestamp: Date;
  backups: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageSizeMB: number;
    oldestBackupAge: number; // hours
    newestBackupAge: number; // hours
  };
  integrity: {
    verifiedBackups: number;
    corruptedBackups: number;
    integrityCheckRate: number;
  };
  recovery: {
    averageRecoveryTimeSeconds: number;
    recoveryTestSuccessRate: number;
    lastSuccessfulTest?: Date;
  };
  rto: {
    targetSeconds: number;
    currentSeconds: number;
    compliance: number; // percentage (100% = meeting target)
  };
  rpo: {
    targetSeconds: number;
    currentSeconds: number;
    compliance: number; // percentage (100% = meeting target)
  };
  alerts: {
    active: number;
    resolved: number;
  };
}

/**
 * Interface for monitoring alert
 */
export interface MonitoringAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  category: 'backup' | 'integrity' | 'recovery' | 'rto' | 'rpo';
  message: string;
  details: any;
  resolved: boolean;
  resolvedAt?: Date;
  notificationsSent: {
    channel: string;
    timestamp: Date;
    success: boolean;
  }[];
}

/**
 * Service responsible for monitoring backup and recovery processes,
 * tracking RTO/RPO compliance, and sending alerts for issues.
 */
@Injectable()
export class BackupMonitoringService {
  private readonly logger = new Logger(BackupMonitoringService.name);
  private config: MonitoringConfig;
  private metrics: MonitoringMetrics;
  private alerts: Map<string, MonitoringAlert> = new Map();
  private metricsHistory: MonitoringMetrics[] = [];

  constructor(
    private readonly backupService: BackupService,
    private readonly disasterRecoveryService: DisasterRecoveryService,
    private readonly dataIntegrityService: DataIntegrityService,
    private readonly recoveryTestingService: RecoveryTestingService,
  ) {
    this.config = this.loadConfig();
    this.initializeMetrics();
  }

  /**
   * Load monitoring configuration
   */
  private loadConfig(): MonitoringConfig {
    // In a real implementation, this would load from environment variables or a config service
    return {
      backupSuccessRateThreshold: parseFloat(process.env.MONITORING_BACKUP_SUCCESS_RATE_THRESHOLD || '95'),
      backupAgeThresholdHours: parseInt(process.env.MONITORING_BACKUP_AGE_THRESHOLD_HOURS || '24', 10),
      rtoComplianceThreshold: parseFloat(process.env.MONITORING_RTO_COMPLIANCE_THRESHOLD || '120'),
      rpoComplianceThreshold: parseFloat(process.env.MONITORING_RPO_COMPLIANCE_THRESHOLD || '120'),
      enableAlerts: process.env.MONITORING_ENABLE_ALERTS !== 'false',
      alertChannels: (process.env.MONITORING_ALERT_CHANNELS || 'email').split(',') as ('email' | 'sms' | 'slack' | 'webhook')[],
      emailRecipients: process.env.MONITORING_EMAIL_RECIPIENTS?.split(','),
      webhookUrl: process.env.MONITORING_WEBHOOK_URL,
    };
  }

  /**
   * Initialize monitoring metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      timestamp: new Date(),
      backups: {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 100,
        averageSizeMB: 0,
        oldestBackupAge: 0,
        newestBackupAge: 0,
      },
      integrity: {
        verifiedBackups: 0,
        corruptedBackups: 0,
        integrityCheckRate: 0,
      },
      recovery: {
        averageRecoveryTimeSeconds: 0,
        recoveryTestSuccessRate: 0,
      },
      rto: {
        targetSeconds: 0,
        currentSeconds: 0,
        compliance: 100,
      },
      rpo: {
        targetSeconds: 0,
        currentSeconds: 0,
        compliance: 100,
      },
      alerts: {
        active: 0,
        resolved: 0,
      },
    };
  }

  /**
   * Schedule regular collection of monitoring metrics
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleMetricsCollection(): Promise<void> {
    try {
      this.logger.debug('Collecting backup monitoring metrics');
      await this.collectMetrics();
      this.checkAlertThresholds();
    } catch (error) {
      this.logger.error(`Metrics collection failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Collect monitoring metrics from all services
   */
  async collectMetrics(): Promise<MonitoringMetrics> {
    const now = new Date();
    
    // Update timestamp
    this.metrics.timestamp = now;
    
    // Collect backup metrics
    await this.collectBackupMetrics();
    
    // Collect integrity metrics
    this.collectIntegrityMetrics();
    
    // Collect recovery metrics
    this.collectRecoveryMetrics();
    
    // Collect RTO/RPO metrics
    this.collectRtoRpoMetrics();
    
    // Update alert counts
    this.metrics.alerts.active = Array.from(this.alerts.values()).filter(alert => !alert.resolved).length;
    this.metrics.alerts.resolved = Array.from(this.alerts.values()).filter(alert => alert.resolved).length;
    
    // Store metrics history (keep last 24 hours)
    this.metricsHistory.push({ ...this.metrics });
    if (this.metricsHistory.length > 24) {
      this.metricsHistory.shift();
    }
    
    return this.metrics;
  }

  /**
   * Collect backup metrics
   */
  private async collectBackupMetrics(): Promise<void> {
    const allBackups = this.backupService.getAllBackups();
    
    // Calculate basic metrics
    this.metrics.backups.total = allBackups.length;
    this.metrics.backups.successful = allBackups.filter(backup => 
      backup.status === 'completed' || backup.status === 'verified'
    ).length;
    this.metrics.backups.failed = allBackups.filter(backup => 
      backup.status === 'failed'
    ).length;
    
    // Calculate success rate
    const completedBackups = this.metrics.backups.successful + this.metrics.backups.failed;
    this.metrics.backups.successRate = completedBackups > 0
      ? (this.metrics.backups.successful / completedBackups) * 100
      : 100;
    
    // Calculate average size
    const totalSize = allBackups.reduce((sum, backup) => sum + backup.size, 0);
    this.metrics.backups.averageSizeMB = allBackups.length > 0
      ? Math.round((totalSize / allBackups.length) / (1024 * 1024))
      : 0;
    
    // Calculate backup ages
    if (allBackups.length > 0) {
      const backupAges = allBackups.map(backup => 
        (new Date().getTime() - backup.timestamp.getTime()) / (1000 * 60 * 60)
      );
      
      this.metrics.backups.oldestBackupAge = Math.max(...backupAges);
      this.metrics.backups.newestBackupAge = Math.min(...backupAges);
    } else {
      this.metrics.backups.oldestBackupAge = 0;
      this.metrics.backups.newestBackupAge = 0;
    }
  }

  /**
   * Collect integrity metrics
   */
  private collectIntegrityMetrics(): void {
    const verificationResults = this.dataIntegrityService.getAllVerificationResults();
    const corruptedBackups = this.dataIntegrityService.getCorruptedBackups();
    
    this.metrics.integrity.verifiedBackups = verificationResults.filter(result => 
      result.verified
    ).length;
    
    this.metrics.integrity.corruptedBackups = corruptedBackups.length;
    
    // Calculate integrity check rate
    const allBackups = this.backupService.getAllBackups();
    this.metrics.integrity.integrityCheckRate = allBackups.length > 0
      ? (verificationResults.length / allBackups.length) * 100
      : 0;
  }

  /**
   * Collect recovery metrics
   */
  private collectRecoveryMetrics(): void {
    const testResults = this.recoveryTestingService.getAllTestResults();
    
    // Calculate average recovery time
    this.metrics.recovery.averageRecoveryTimeSeconds = 
      this.recoveryTestingService.calculateAverageRecoveryTime();
    
    // Calculate recovery test success rate
    this.metrics.recovery.recoveryTestSuccessRate = testResults.length > 0
      ? (testResults.filter(result => result.success).length / testResults.length) * 100
      : 0;
    
    // Find last successful test
    const successfulTests = testResults
      .filter(result => result.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (successfulTests.length > 0) {
      this.metrics.recovery.lastSuccessfulTest = successfulTests[0].timestamp;
    }
  }

  /**
   * Collect RTO/RPO metrics
   */
  private collectRtoRpoMetrics(): void {
    // Get RTO metrics
    const targetRto = this.disasterRecoveryService.calculateCurrentRTO();
    const currentRto = this.metrics.recovery.averageRecoveryTimeSeconds;
    
    this.metrics.rto.targetSeconds = targetRto;
    this.metrics.rto.currentSeconds = currentRto;
    this.metrics.rto.compliance = targetRto > 0
      ? Math.min(100, (targetRto / currentRto) * 100)
      : 100;
    
    // Get RPO metrics
    const targetRpo = this.disasterRecoveryService.calculateCurrentRPO();
    const currentRpo = this.calculateCurrentRPO();
    
    this.metrics.rpo.targetSeconds = targetRpo;
    this.metrics.rpo.currentSeconds = currentRpo;
    this.metrics.rpo.compliance = targetRpo > 0
      ? Math.min(100, (targetRpo / currentRpo) * 100)
      : 100;
  }

  /**
   * Calculate current RPO based on backup frequency
   */
  private calculateCurrentRPO(): number {
    const allBackups = this.backupService.getAllBackups();
    
    if (allBackups.length < 2) {
      return this.metrics.rpo.targetSeconds; // Not enough data
    }
    
    // Sort backups by timestamp (newest first)
    const sortedBackups = [...allBackups].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    // Calculate average time between backups
    let totalTimeBetweenBackups = 0;
    for (let i = 0; i < sortedBackups.length - 1; i++) {
      const timeDiff = sortedBackups[i].timestamp.getTime() - sortedBackups[i + 1].timestamp.getTime();
      totalTimeBetweenBackups += timeDiff / 1000; // Convert to seconds
    }
    
    return Math.round(totalTimeBetweenBackups / (sortedBackups.length - 1));
  }

  /**
   * Check if any metrics exceed alert thresholds
   */
  private checkAlertThresholds(): void {
    // Check backup success rate
    if (this.metrics.backups.successRate < this.config.backupSuccessRateThreshold) {
      this.createAlert(
        'warning',
        'backup',
        `Backup success rate (${this.metrics.backups.successRate.toFixed(1)}%) below threshold (${this.config.backupSuccessRateThreshold}%)`,
        {
          successRate: this.metrics.backups.successRate,
          threshold: this.config.backupSuccessRateThreshold,
          failedBackups: this.metrics.backups.failed,
        }
      );
    }
    
    // Check backup age
    if (this.metrics.backups.newestBackupAge > this.config.backupAgeThresholdHours) {
      this.createAlert(
        'critical',
        'backup',
        `No recent backups found. Newest backup is ${this.metrics.backups.newestBackupAge.toFixed(1)} hours old (threshold: ${this.config.backupAgeThresholdHours} hours)`,
        {
          newestBackupAge: this.metrics.backups.newestBackupAge,
          threshold: this.config.backupAgeThresholdHours,
        }
      );
    }
    
    // Check corrupted backups
    if (this.metrics.integrity.corruptedBackups > 0) {
      this.createAlert(
        'critical',
        'integrity',
        `${this.metrics.integrity.corruptedBackups} corrupted backups detected`,
        {
          corruptedBackups: this.metrics.integrity.corruptedBackups,
          verifiedBackups: this.metrics.integrity.verifiedBackups,
        }
      );
    }
    
    // Check RTO compliance
    if (this.metrics.rto.compliance < 100) {
      const severity = this.metrics.rto.compliance < 80 ? 'critical' : 'warning';
      
      this.createAlert(
        severity,
        'rto',
        `RTO non-compliant: Current ${this.metrics.rto.currentSeconds}s exceeds target ${this.metrics.rto.targetSeconds}s (${this.metrics.rto.compliance.toFixed(1)}% compliance)`,
        {
          currentRto: this.metrics.rto.currentSeconds,
          targetRto: this.metrics.rto.targetSeconds,
          compliance: this.metrics.rto.compliance,
        }
      );
    }
    
    // Check RPO compliance
    if (this.metrics.rpo.compliance < 100) {
      const severity = this.metrics.rpo.compliance < 80 ? 'critical' : 'warning';
      
      this.createAlert(
        severity,
        'rpo',
        `RPO non-compliant: Current ${this.metrics.rpo.currentSeconds}s exceeds target ${this.metrics.rpo.targetSeconds}s (${this.metrics.rpo.compliance.toFixed(1)}% compliance)`,
        {
          currentRpo: this.metrics.rpo.currentSeconds,
          targetRpo: this.metrics.rpo.targetSeconds,
          compliance: this.metrics.rpo.compliance,
        }
      );
    }
  }

  /**
   * Create a monitoring alert
   * @param severity Alert severity
   * @param category Alert category
   * @param message Alert message
   * @param details Additional details
   */
  private createAlert(
    severity: 'info' | 'warning' | 'critical',
    category: 'backup' | 'integrity' | 'recovery' | 'rto' | 'rpo',
    message: string,
    details: any
  ): void {
    // Create a unique ID for the alert based on category and message
    const alertId = `${category}-${this.hashString(message)}`;
    
    // Check if this alert already exists
    const existingAlert = this.alerts.get(alertId);
    if (existingAlert && !existingAlert.resolved) {
      // Alert already active, don't create a duplicate
      return;
    }
    
    // Create new alert
    const alert: MonitoringAlert = {
      id: alertId,
      timestamp: new Date(),
      severity,
      category,
      message,
      details,
      resolved: false,
      notificationsSent: [],
    };
    
    this.alerts.set(alertId, alert);
    
    this.logger.warn(`${severity.toUpperCase()} ALERT: ${message}`);
    
    // Send notifications if enabled
    if (this.config.enableAlerts) {
      this.sendAlertNotifications(alert);
    }
  }

  /**
   * Create a simple hash of a string
   * @param str String to hash
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Send notifications for an alert
   * @param alert Alert to send notifications for
   */
  private async sendAlertNotifications(alert: MonitoringAlert): Promise<void> {
    for (const channel of this.config.alertChannels) {
      try {
        await this.sendNotification(channel, alert);
        
        alert.notificationsSent.push({
          channel,
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification: ${error.message}`, error.stack);
        
        alert.notificationsSent.push({
          channel,
          timestamp: new Date(),
          success: false,
        });
      }
    }
  }

  /**
   * Send a notification through a specific channel
   * @param channel Notification channel
   * @param alert Alert to send
   */
  private async sendNotification(
    channel: 'email' | 'sms' | 'slack' | 'webhook',
    alert: MonitoringAlert
  ): Promise<void> {
    // In a real implementation, this would send notifications through the specified channel
    this.logger.log(`Sending ${alert.severity} alert via ${channel}: ${alert.message}`);
    
    // Simulate sending notification
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Resolve an alert
   * @param alertId ID of the alert to resolve
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }
    
    alert.resolved = true;
    alert.resolvedAt = new Date();
    
    this.logger.log(`Resolved alert: ${alert.message}`);
    return true;
  }

  /**
   * Get current monitoring metrics
   */
  getCurrentMetrics(): MonitoringMetrics {
    return this.metrics;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): MonitoringMetrics[] {
    return this.metricsHistory;
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): MonitoringAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved);
  }

  /**
   * Generate a monitoring dashboard report
   */
  generateMonitoringDashboard(): any {
    return {
      timestamp: new Date(),
      currentMetrics: this.metrics,
      activeAlerts: this.getActiveAlerts(),
      backupTrend: this.calculateBackupTrend(),
      recoveryTimeTrend: this.calculateRecoveryTimeTrend(),
      complianceStatus: {
        rto: this.metrics.rto.compliance >= 100 ? 'compliant' : 'non-compliant',
        rpo: this.metrics.rpo.compliance >= 100 ? 'compliant' : 'non-compliant',
        overall: this.metrics.rto.compliance >= 100 && this.metrics.rpo.compliance >= 100
          ? 'compliant'
          : 'non-compliant',
      },
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Calculate backup trend from metrics history
   */
  private calculateBackupTrend(): any {
    if (this.metricsHistory.length < 2) {
      return { trend: 'stable', change: 0 };
    }
    
    const current = this.metricsHistory[this.metricsHistory.length - 1].backups.successRate;
    const previous = this.metricsHistory[0].backups.successRate;
    const change = current - previous;
    
    let trend = 'stable';
    if (change > 5) trend = 'improving';
    if (change < -5) trend = 'degrading';
    
    return { trend, change };
  }

  /**
   * Calculate recovery time trend from metrics history
   */
  private calculateRecoveryTimeTrend(): any {
    if (this.metricsHistory.length < 2) {
      return { trend: 'stable', change: 0 };
    }
    
    const current = this.metricsHistory[this.metricsHistory.length - 1].recovery.averageRecoveryTimeSeconds;
    const previous = this.metricsHistory[0].recovery.averageRecoveryTimeSeconds;
    
    if (current === 0 || previous === 0) {
      return { trend: 'unknown', change: 0 };
    }
    
    const change = ((current - previous) / previous) * 100;
    
    let trend = 'stable';
    if (change < -10) trend = 'improving'; // Lower recovery time is better
    if (change > 10) trend = 'degrading';
    
    return { trend, change };
  }

  /**
   * Generate recommendations based on current metrics
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Backup recommendations
    if (this.metrics.backups.successRate < 95) {
      recommendations.push('Investigate and address backup failures to improve success rate');
    }
    
    if (this.metrics.backups.newestBackupAge > 12) {
      recommendations.push('Schedule more frequent backups to reduce RPO');
    }
    
    // Integrity recommendations
    if (this.metrics.integrity.integrityCheckRate < 20) {
      recommendations.push('Increase integrity verification coverage');
    }
    
    if (this.metrics.integrity.corruptedBackups > 0) {
      recommendations.push('Address corrupted backups immediately');
    }
    
    // Recovery recommendations
    if (this.metrics.recovery.averageRecoveryTimeSeconds > this.metrics.rto.targetSeconds) {
      recommendations.push('Optimize recovery procedures to meet RTO requirements');
    }
    
    if (this.metrics.recovery.recoveryTestSuccessRate < 90) {
      recommendations.push('Improve recovery testing success rate');
    }
    
    return recommendations;
  }
}