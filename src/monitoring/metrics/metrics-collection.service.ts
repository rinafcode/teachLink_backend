import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Histogram, Gauge, Counter } from 'prom-client';

/**
 * Central Prometheus metrics registry for TeachLink.
 *
 * Provides:
 *  - Infrastructure metrics: HTTP request duration, DB query duration,
 *    active connections, DB pool statistics
 *  - Business metrics: user registrations, course enrolments, assessment
 *    completions, payment transactions, active users, cache hit rate,
 *    queue processing time, email campaigns, backup operations, API errors
 *
 * All metrics are registered on a dedicated `Registry` instance to avoid
 * conflicts when running multiple test suites or module instances.
 */
@Injectable()
export class MetricsCollectionService implements OnModuleInit {
  private registry: Registry;

  // ── Infrastructure – HTTP ─────────────────────────────────────────────────

  public httpRequestDuration: Histogram;

  // ── Infrastructure – Database ─────────────────────────────────────────────

  public dbQueryDuration: Histogram;
  public dbPoolActiveConnections: Gauge;

  /** Total DB pool connections acquired since startup */
  public dbPoolConnectionsAcquired: Counter;
  /** Total DB pool connections released since startup */
  public dbPoolConnectionsReleased: Counter;
  /** Current DB connection pool size (active + idle) */
  public dbPoolSize: Gauge;
  /** Configured maximum DB connection pool capacity */
  public dbPoolMaxConnections: Gauge;
  /** Current pool utilisation as a ratio in [0, 1] */
  public dbPoolUtilization: Gauge;
  /** Currently idle / available pool connections */
  public dbPoolIdleConnections: Gauge;
  /** Requests queued waiting for a free pool slot */
  public dbPoolWaitingRequests: Gauge;
  /** Total number of DB pool connections that had to wait since startup */
  public dbPoolWaitCount: Counter;
  /** Duration of database connection checkout waiting in seconds */
  public dbPoolWaitDuration: Histogram;
  /** Total number of DB pool connections closed due to idle timeout */
  public dbPoolMaxIdleClosed: Counter;
  /** Total number of DB pool connections closed due to max lifetime */
  public dbPoolMaxLifetimeClosed: Counter;
  /** Total number of database queries that exceeded the slow query threshold */
  public dbSlowQueriesCount: Counter;

  // ── Business Metrics – Users ───────────────────────────────────────────────

  /** Total user registrations, labelled by user_type and source */
  public userRegistrations: Counter;
  /** Gauge for currently active users, labelled by role */
  public activeUsers: Gauge;

  // ── Business Metrics – Courses ─────────────────────────────────────────────

  /** Total course enrolments, labelled by course_id and status */
  public courseEnrollments: Counter;
  /** Per-course completion rate (0–100), labelled by course_id */
  public courseCompletionRate: Gauge;

  // ── Business Metrics – Assessments ────────────────────────────────────────

  /** Total assessment completions, labelled by assessment_type and difficulty */
  public assessmentCompletions: Counter;

  // ── Business Metrics – Learning Paths ─────────────────────────────────────

  /** Learning path progress percentage, labelled by path_id and user_id */
  public learningPathProgress: Gauge;

  // ── Business Metrics – Payments ───────────────────────────────────────────

  /** Total payment transactions, labelled by payment_method and status */
  public paymentTransactions: Counter;

  // ── Business Metrics – Cache ───────────────────────────────────────────────

  /** Cache hit rate percentage, labelled by cache_type */
  public cacheHitRate: Gauge;

  // ── Business Metrics – Queues ──────────────────────────────────────────────

  /** Queue job processing duration, labelled by queue_name and job_type */
  public queueProcessingTime: Histogram;

  // ── Business Metrics – Email ───────────────────────────────────────────────

  /** Total email campaigns sent, labelled by campaign_type and status */
  public emailCampaignsSent: Counter;

  // ── Business Metrics – Backup ──────────────────────────────────────────────

  /** Total backup operations, labelled by operation_type and status */
  public backupOperations: Counter;

  // ── Business Metrics – API Errors ─────────────────────────────────────────

  /** Total API errors (≥ 400), labelled by route and error_code */
  public apiErrors: Counter;

  // ── Business Metrics – Workers ────────────────────────────────────────────

  /** Total worker restarts, labelled by worker_name */
  public workerRestartsTotal: Counter;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor() {
    this.registry = new Registry();
    this.initialiseMetrics();
  }

  // ── Module lifecycle ──────────────────────────────────────────────────────

  onModuleInit() {
    // Collect default system metrics (CPU, memory, event loop lag, GC, etc.)
    collectDefaultMetrics({ register: this.registry });
  }

  // ── Registry access ───────────────────────────────────────────────────────

  /**
   * Returns the Prometheus Registry instance used by this service.
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Returns all registered metrics in Prometheus text exposition format.
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // ── Recording helpers – HTTP ──────────────────────────────────────────────

  /**
   * Observes an HTTP request duration.
   *
   * @param method      HTTP method (GET, POST, …)
   * @param route       Normalised route path (e.g. /users/:id)
   * @param statusCode  HTTP response status code
   * @param duration    Duration in **seconds**
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  // ── Recording helpers – Database ──────────────────────────────────────────

  /**
   * Observes a database query duration.
   *
   * @param queryType  SQL verb (SELECT, INSERT, UPDATE, DELETE, OTHER)
   * @param table      Primary table name
   * @param duration   Duration in **seconds**
   */
  recordDbQuery(queryType: string, table: string, duration: number): void {
    this.dbQueryDuration.observe({ query_type: queryType, table }, duration);
  }

  // ── Recording helpers – Users ─────────────────────────────────────────────

  recordUserRegistration(userType: string, source: string): void {
    this.userRegistrations.inc({ user_type: userType, source });
  }

  updateActiveUsers(role: string, count: number): void {
    this.activeUsers.set({ role }, count);
  }

  // ── Recording helpers – Courses ───────────────────────────────────────────

  recordCourseEnrollment(courseId: string, status: string): void {
    this.courseEnrollments.inc({ course_id: courseId, status });
  }

  updateCourseCompletionRate(courseId: string, rate: number): void {
    this.courseCompletionRate.set({ course_id: courseId }, rate);
  }

  // ── Recording helpers – Assessments ──────────────────────────────────────

  recordAssessmentCompletion(assessmentType: string, difficulty: string): void {
    this.assessmentCompletions.inc({ assessment_type: assessmentType, difficulty });
  }

  // ── Recording helpers – Learning Paths ───────────────────────────────────

  updateLearningPathProgress(pathId: string, userId: string, progress: number): void {
    this.learningPathProgress.set({ path_id: pathId, user_id: userId }, progress);
  }

  // ── Recording helpers – Payments ─────────────────────────────────────────

  recordPaymentTransaction(paymentMethod: string, status: string): void {
    this.paymentTransactions.inc({ payment_method: paymentMethod, status });
  }

  // ── Recording helpers – Cache ─────────────────────────────────────────────

  updateCacheHitRate(cacheType: string, hitRate: number): void {
    this.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }

  // ── Recording helpers – Queues ────────────────────────────────────────────

  recordQueueProcessingTime(queueName: string, jobType: string, duration: number): void {
    this.queueProcessingTime.observe({ queue_name: queueName, job_type: jobType }, duration);
  }

  // ── Recording helpers – Email ─────────────────────────────────────────────

  recordEmailCampaignSent(campaignType: string, status: string): void {
    this.emailCampaignsSent.inc({ campaign_type: campaignType, status });
  }

  // ── Recording helpers – Backup ────────────────────────────────────────────

  recordBackupOperation(operationType: string, status: string): void {
    this.backupOperations.inc({ operation_type: operationType, status });
  }

  // ── Recording helpers – API Errors ────────────────────────────────────────

  recordApiError(route: string, errorCode: string): void {
    this.apiErrors.inc({ route, error_code: errorCode });
  }

  // ── Recording helpers – Workers ──────────────────────────────────────────

  recordWorkerRestart(workerName: string): void {
    this.workerRestartsTotal.inc({ worker_name: workerName });
  }

  // ── Private – metric registration ─────────────────────────────────────────

  private initialiseMetrics(): void {
    // HTTP
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // Database – query durations
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // Database – connections
    this.dbPoolActiveConnections = new Gauge({
      name: 'db_pool_active_connections',
      help: 'Number of currently active (checked-out) connections in the DB pool',
      registers: [this.registry],
    });

    this.dbPoolConnectionsAcquired = new Counter({
      name: 'db_pool_connections_acquired_total',
      help: 'Total number of DB pool connections acquired since startup',
      registers: [this.registry],
    });

    this.dbPoolConnectionsReleased = new Counter({
      name: 'db_pool_connections_released_total',
      help: 'Total number of DB pool connections released since startup',
      registers: [this.registry],
    });

    this.dbPoolSize = new Gauge({
      name: 'db_pool_size',
      help: 'Current total DB connection pool size (active + idle)',
      registers: [this.registry],
    });

    this.dbPoolMaxConnections = new Gauge({
      name: 'db_pool_max_connections',
      help: 'Configured maximum DB connection pool capacity',
      registers: [this.registry],
    });

    this.dbPoolUtilization = new Gauge({
      name: 'db_pool_utilization',
      help: 'Current DB pool utilisation as a ratio in [0, 1] (active / max)',
      registers: [this.registry],
    });

    this.dbPoolIdleConnections = new Gauge({
      name: 'db_pool_idle_connections',
      help: 'Number of idle (available) connections in the DB pool',
      registers: [this.registry],
    });

    this.dbPoolWaitingRequests = new Gauge({
      name: 'db_pool_waiting_requests',
      help: 'Number of requests waiting for a free DB pool connection',
      registers: [this.registry],
    });

    this.dbPoolWaitCount = new Counter({
      name: 'db_pool_waits_total',
      help: 'Total number of DB pool connections that had to wait since startup',
      registers: [this.registry],
    });

    this.dbPoolWaitDuration = new Histogram({
      name: 'db_pool_wait_duration_seconds',
      help: 'Duration of database connection checkout waiting in seconds',
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.dbPoolMaxIdleClosed = new Counter({
      name: 'db_pool_max_idle_closed_total',
      help: 'Total number of DB pool connections closed due to idle timeout',
      registers: [this.registry],
    });

    this.dbPoolMaxLifetimeClosed = new Counter({
      name: 'db_pool_max_lifetime_closed_total',
      help: 'Total number of DB pool connections closed due to max lifetime',
      registers: [this.registry],
    });

    this.dbSlowQueriesCount = new Counter({
      name: 'db_slow_queries_total',
      help: 'Total number of database queries that exceeded the slow query threshold',
      labelNames: ['query_type', 'table'],
      registers: [this.registry],
    });

    // Users
    this.userRegistrations = new Counter({
      name: 'user_registrations_total',
      help: 'Total number of user registrations',
      labelNames: ['user_type', 'source'],
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of currently active users by role',
      labelNames: ['role'],
      registers: [this.registry],
    });

    // Courses
    this.courseEnrollments = new Counter({
      name: 'course_enrollments_total',
      help: 'Total number of course enrolments',
      labelNames: ['course_id', 'status'],
      registers: [this.registry],
    });

    this.courseCompletionRate = new Gauge({
      name: 'course_completion_rate_percentage',
      help: 'Completion rate percentage for a course (0–100)',
      labelNames: ['course_id'],
      registers: [this.registry],
    });

    // Assessments
    this.assessmentCompletions = new Counter({
      name: 'assessment_completions_total',
      help: 'Total number of assessment completions',
      labelNames: ['assessment_type', 'difficulty'],
      registers: [this.registry],
    });

    // Learning paths
    this.learningPathProgress = new Gauge({
      name: 'learning_path_progress_percentage',
      help: 'Average learning path progress percentage',
      labelNames: ['path_id', 'user_id'],
      registers: [this.registry],
    });

    // Payments
    this.paymentTransactions = new Counter({
      name: 'payment_transactions_total',
      help: 'Total number of payment transactions',
      labelNames: ['payment_method', 'status'],
      registers: [this.registry],
    });

    // Cache
    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate_percentage',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.registry],
    });

    // Queues
    this.queueProcessingTime = new Histogram({
      name: 'queue_processing_duration_seconds',
      help: 'Duration of queue job processing in seconds',
      labelNames: ['queue_name', 'job_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    // Email
    this.emailCampaignsSent = new Counter({
      name: 'email_campaigns_sent_total',
      help: 'Total number of email campaigns sent',
      labelNames: ['campaign_type', 'status'],
      registers: [this.registry],
    });

    // Backup
    this.backupOperations = new Counter({
      name: 'backup_operations_total',
      help: 'Total number of backup operations',
      labelNames: ['operation_type', 'status'],
      registers: [this.registry],
    });

    // API Errors
    this.apiErrors = new Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors (HTTP 4xx/5xx)',
      labelNames: ['route', 'error_code'],
      registers: [this.registry],
    });

    // Workers
    this.workerRestartsTotal = new Counter({
      name: 'worker_restarts_total',
      help: 'Total number of worker restarts due to stalling',
      labelNames: ['worker_name'],
      registers: [this.registry],
    });
  }
}
