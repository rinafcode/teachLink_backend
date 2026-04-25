import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Histogram, Gauge, Counter } from 'prom-client';
@Injectable()
export class MetricsCollectionService implements OnModuleInit {
    private registry: Registry;
    public httpRequestDuration: Histogram;
    public dbQueryDuration: Histogram;
    public activeConnections: Gauge;
    public userRegistrations: Counter;
    public assessmentCompletions: Counter;
    public learningPathProgress: Gauge;
    public cacheHitRate: Gauge;
    public queueProcessingTime: Histogram;
    public emailCampaignsSent: Counter;
    public backupOperations: Counter;
    constructor() {
        this.registry = new Registry();
        // HTTP Request Duration
        this.httpRequestDuration = new Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5],
            registers: [this.registry],
        });
        // Database Query Duration
        this.dbQueryDuration = new Histogram({
            name: 'db_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['query_type', 'table'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
            registers: [this.registry],
        });
        // Active Connections (Example of custom gauge)
        this.activeConnections = new Gauge({
            name: 'active_connections_count',
            help: 'Number of active connections',
            registers: [this.registry],
        });
        // User Registrations Counter
        this.userRegistrations = new Counter({
            name: 'user_registrations_total',
            help: 'Total number of user registrations',
            labelNames: ['user_type', 'source'],
            registers: [this.registry],
        });
        // Assessment Completions Counter
        this.assessmentCompletions = new Counter({
            name: 'assessment_completions_total',
            help: 'Total number of assessment completions',
            labelNames: ['assessment_type', 'difficulty'],
            registers: [this.registry],
        });
        // Learning Path Progress Gauge
        this.learningPathProgress = new Gauge({
            name: 'learning_path_progress_percentage',
            help: 'Average learning path progress percentage',
            labelNames: ['path_id', 'user_id'],
            registers: [this.registry],
        });
        // Cache Hit Rate Gauge
        this.cacheHitRate = new Gauge({
            name: 'cache_hit_rate_percentage',
            help: 'Cache hit rate percentage',
            labelNames: ['cache_type'],
            registers: [this.registry],
        });
        // Queue Processing Time Histogram
        this.queueProcessingTime = new Histogram({
            name: 'queue_processing_duration_seconds',
            help: 'Duration of queue job processing in seconds',
            labelNames: ['queue_name', 'job_type'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
            registers: [this.registry],
        });
        // Email Campaigns Sent Counter
        this.emailCampaignsSent = new Counter({
            name: 'email_campaigns_sent_total',
            help: 'Total number of email campaigns sent',
            labelNames: ['campaign_type', 'status'],
            registers: [this.registry],
        });
        // Backup Operations Counter
        this.backupOperations = new Counter({
            name: 'backup_operations_total',
            help: 'Total number of backup operations',
            labelNames: ['operation_type', 'status'],
            registers: [this.registry],
        });
    }
    onModuleInit() {
        // Collect default system metrics (CPU, Memory, Event Loop, etc.)
        collectDefaultMetrics({ register: this.registry });
    }
    getRegistry(): Registry {
        return this.registry;
    }
    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
    recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
        this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    }
    recordDbQuery(queryType: string, table: string, duration: number) {
        this.dbQueryDuration.observe({ query_type: queryType, table }, duration);
    }
    // Custom business metrics methods
    recordUserRegistration(userType: string, source: string) {
        this.userRegistrations.inc({ user_type: userType, source });
    }
    recordAssessmentCompletion(assessmentType: string, difficulty: string) {
        this.assessmentCompletions.inc({ assessment_type: assessmentType, difficulty });
    }
    updateLearningPathProgress(pathId: string, userId: string, progress: number) {
        this.learningPathProgress.set({ path_id: pathId, user_id: userId }, progress);
    }
    updateCacheHitRate(cacheType: string, hitRate: number) {
        this.cacheHitRate.set({ cache_type: cacheType }, hitRate);
    }
    recordQueueProcessingTime(queueName: string, jobType: string, duration: number) {
        this.queueProcessingTime.observe({ queue_name: queueName, job_type: jobType }, duration);
    }
    recordEmailCampaignSent(campaignType: string, status: string) {
        this.emailCampaignsSent.inc({ campaign_type: campaignType, status });
    }
    recordBackupOperation(operationType: string, status: string) {
        this.backupOperations.inc({ operation_type: operationType, status });
    }
}
