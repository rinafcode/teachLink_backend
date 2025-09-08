import { Test, TestingModule } from '@nestjs/testing';
import { QueueMonitoringService, AlertSeverity, AlertType } from '../monitoring/queue-monitoring.service';
import { JobStatus } from '../interfaces/job.interface';

describe('QueueMonitoringService', () => {
  let service: QueueMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueMonitoringService],
    }).compile();

    service = module.get<QueueMonitoringService>(QueueMonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Monitoring Configuration', () => {
    it('should set and get monitoring configuration', () => {
      const config = {
        enabled: true,
        collectionIntervalMs: 5000,
        historySize: 100,
        alertThresholds: {
          maxQueueSize: 1000,
          maxErrorRate: 0.1,
          maxLatency: 5000,
          maxProcessingTime: 10000,
        },
      };

      service.setMonitoringConfig(config);
      const retrievedConfig = service.getMonitoringConfig();

      expect(retrievedConfig).toEqual(config);
    });

    it('should have default configuration', () => {
      const config = service.getMonitoringConfig();
      
      expect(config).toBeDefined();
      expect(config.enabled).toBeDefined();
      expect(config.collectionIntervalMs).toBeDefined();
      expect(config.historySize).toBeDefined();
      expect(config.alertThresholds).toBeDefined();
    });
  });

  describe('Monitoring Control', () => {
    it('should start and stop monitoring', () => {
      // Start monitoring
      service.startMonitoring();
      expect(service.isMonitoring()).toBe(true);
      
      // Stop monitoring
      service.stopMonitoring();
      expect(service.isMonitoring()).toBe(false);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics', () => {
      const metrics = {
        timestamp: new Date(),
        queueSize: 10,
        processingCount: 2,
        completedCount: 5,
        failedCount: 1,
        averageLatency: 150,
        averageProcessingTime: 200,
        throughput: 10,
        errorRate: 0.1,
      };
      
      service.collectMetrics(metrics);
      
      const history = service.getMetricsHistory();
      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1]).toEqual(metrics);
    });

    it('should limit metrics history size', () => {
      // Set a small history size
      service.setMonitoringConfig({
        enabled: true,
        collectionIntervalMs: 1000,
        historySize: 3,
        alertThresholds: {},
      });
      
      // Add more metrics than the history size
      for (let i = 0; i < 5; i++) {
        service.collectMetrics({
          timestamp: new Date(),
          queueSize: i,
          processingCount: i,
          completedCount: i,
          failedCount: i,
          averageLatency: i * 10,
          averageProcessingTime: i * 20,
          throughput: i,
          errorRate: i * 0.1,
        });
      }
      
      const history = service.getMetricsHistory();
      expect(history.length).toBe(3); // Should be limited to 3
      expect(history[history.length - 1].queueSize).toBe(4); // Last added metric
    });
  });

  describe('Alert Handling', () => {
    beforeEach(() => {
      // Set up configuration with thresholds
      service.setMonitoringConfig({
        enabled: true,
        collectionIntervalMs: 1000,
        historySize: 100,
        alertThresholds: {
          maxQueueSize: 50,
          maxErrorRate: 0.2,
          maxLatency: 500,
          maxProcessingTime: 1000,
        },
      });
    });

    it('should check for alerts and generate them when thresholds are exceeded', () => {
      // Add metrics that exceed thresholds
      service.collectMetrics({
        timestamp: new Date(),
        queueSize: 100, // Exceeds maxQueueSize
        processingCount: 10,
        completedCount: 20,
        failedCount: 10,
        averageLatency: 600, // Exceeds maxLatency
        averageProcessingTime: 800,
        throughput: 5,
        errorRate: 0.3, // Exceeds maxErrorRate
      });
      
      // Check for alerts
      service.checkAlerts();
      
      // Get active alerts
      const alerts = service.getActiveAlerts();
      
      expect(alerts).toBeDefined();
      expect(alerts.length).toBeGreaterThan(0);
      
      // Should have alerts for queue size, latency, and error rate
      expect(alerts.some(a => a.type === AlertType.QUEUE_SIZE)).toBe(true);
      expect(alerts.some(a => a.type === AlertType.LATENCY)).toBe(true);
      expect(alerts.some(a => a.type === AlertType.ERROR_RATE)).toBe(true);
    });

    it('should not generate alerts when metrics are below thresholds', () => {
      // Add metrics that are below thresholds
      service.collectMetrics({
        timestamp: new Date(),
        queueSize: 20, // Below maxQueueSize
        processingCount: 5,
        completedCount: 10,
        failedCount: 1,
        averageLatency: 300, // Below maxLatency
        averageProcessingTime: 500,
        throughput: 5,
        errorRate: 0.1, // Below maxErrorRate
      });
      
      // Check for alerts
      service.checkAlerts();
      
      // Get active alerts
      const alerts = service.getActiveAlerts();
      
      // Should have no alerts
      expect(alerts.length).toBe(0);
    });

    it('should resolve alerts when metrics return to normal', () => {
      // First add metrics that exceed thresholds
      service.collectMetrics({
        timestamp: new Date(),
        queueSize: 100,
        processingCount: 10,
        completedCount: 20,
        failedCount: 10,
        averageLatency: 600,
        averageProcessingTime: 800,
        throughput: 5,
        errorRate: 0.3,
      });
      
      // Check for alerts
      service.checkAlerts();
      
      // Verify alerts were created
      expect(service.getActiveAlerts().length).toBeGreaterThan(0);
      
      // Now add metrics that are below thresholds
      service.collectMetrics({
        timestamp: new Date(),
        queueSize: 20,
        processingCount: 5,
        completedCount: 30,
        failedCount: 1,
        averageLatency: 300,
        averageProcessingTime: 500,
        throughput: 5,
        errorRate: 0.05,
      });
      
      // Check for alerts again
      service.checkAlerts();
      
      // Alerts should be resolved
      expect(service.getActiveAlerts().length).toBe(0);
    });
  });

  describe('Job Tracking', () => {
    it('should track job completion', () => {
      const job = {
        id: '1',
        name: 'test-job',
        data: {},
        priority: 5,
        createdAt: new Date(Date.now() - 1000), // 1 second ago
        scheduledFor: null,
        attempts: 1,
        maxAttempts: 3,
        lastError: null,
        lastAttemptedAt: new Date(Date.now() - 500), // 0.5 seconds ago
        status: JobStatus.COMPLETED,
        options: {},
      };
      
      // Track job completion
      service.trackJobCompletion(job, 500); // 500ms processing time
      
      // Get current metrics
      const metrics = service.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.completedCount).toBeGreaterThan(0);
      expect(metrics.averageProcessingTime).toBe(500);
    });

    it('should track job failure', () => {
      const job = {
        id: '2',
        name: 'test-job',
        data: {},
        priority: 5,
        createdAt: new Date(Date.now() - 1000),
        scheduledFor: null,
        attempts: 1,
        maxAttempts: 3,
        lastError: 'Test error',
        lastAttemptedAt: new Date(),
        status: JobStatus.FAILED,
        options: {},
      };
      
      // Track job failure
      service.trackJobFailure(job, 'Test error');
      
      // Get current metrics
      const metrics = service.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.failedCount).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeGreaterThan(0);
    });
  });

  describe('Health Status', () => {
    it('should return healthy status when no alerts', () => {
      // Ensure no active alerts
      service['activeAlerts'] = [];
      
      const health = service.getQueueHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.issues).toEqual([]);
    });

    it('should return warning status when low severity alerts exist', () => {
      // Add a low severity alert
      service['activeAlerts'] = [{
        id: '1',
        type: AlertType.QUEUE_SIZE,
        message: 'Queue size is high',
        severity: AlertSeverity.LOW,
        timestamp: new Date(),
        value: 60,
        threshold: 50,
      }];
      
      const health = service.getQueueHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toBe('warning');
      expect(health.issues.length).toBe(1);
    });

    it('should return critical status when high severity alerts exist', () => {
      // Add a high severity alert
      service['activeAlerts'] = [{
        id: '1',
        type: AlertType.ERROR_RATE,
        message: 'Error rate is very high',
        severity: AlertSeverity.HIGH,
        timestamp: new Date(),
        value: 0.5,
        threshold: 0.2,
      }];
      
      const health = service.getQueueHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toBe('critical');
      expect(health.issues.length).toBe(1);
    });
  });
});