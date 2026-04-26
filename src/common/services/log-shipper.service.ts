import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

/** Index prefix used for all application logs. */
const LOG_INDEX_PREFIX = 'teachlink-logs';

/** Elasticsearch index mappings for structured log fields. */
const LOG_INDEX_MAPPINGS = {
  mappings: {
    dynamic: false,
    properties: {
      '@timestamp': { type: 'date' },
      service: { type: 'keyword' },
      environment: { type: 'keyword' },
      level: { type: 'keyword' },
      event: { type: 'keyword' },
      correlationId: { type: 'keyword' },
      method: { type: 'keyword' },
      url: { type: 'keyword' },
      route: { type: 'keyword' },
      ip: { type: 'ip' },
      userAgent: { type: 'text' },
      userId: { type: 'keyword' },
      userRole: { type: 'keyword' },
      statusCode: { type: 'integer' },
      responseTimeMs: { type: 'long' },
      contentLength: { type: 'long' },
    },
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
};

/** Index template name applied to all `teachlink-logs-*` indices. */
const LOG_INDEX_TEMPLATE = 'teachlink-logs-template';

/**
 * #361 – LogShipperService
 *
 * Ships structured log entries to Elasticsearch using a daily rolling index
 * pattern: `teachlink-logs-YYYY.MM.DD`.
 *
 * - Shipping is fire-and-forget; errors are caught and logged locally so a
 *   downed Elasticsearch cluster never impacts API availability.
 * - An index template is registered on module init so all future daily indices
 *   inherit the correct field mappings automatically.
 * - The service is disabled when `ELASTICSEARCH_NODE` is not configured.
 */
@Injectable()
export class LogShipperService implements OnModuleInit {
  private readonly logger = new Logger(LogShipperService.name);
  private client: Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const node = this.configService.get<string>('ELASTICSEARCH_NODE');
    if (!node) {
      this.logger.warn('ELASTICSEARCH_NODE not set – log shipping is disabled');
      return;
    }

    const username = this.configService.get<string>('ELASTICSEARCH_USERNAME');
    const password = this.configService.get<string>('ELASTICSEARCH_PASSWORD');
    const apiKey = this.configService.get<string>('ELASTICSEARCH_API_KEY');

    const auth = apiKey ? { apiKey } : username && password ? { username, password } : undefined;

    this.client = new Client({ node, auth });

    // Register the index template asynchronously; non-fatal if it fails.
    this.ensureIndexTemplate().catch((err: unknown) => {
      this.logger.warn(
        `Failed to register log index template: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  /**
   * Ships a structured log entry to Elasticsearch.
   * Fire-and-forget – never throws.
   */
  ship(entry: Record<string, unknown>): void {
    if (!this.client) return;

    const index = this.dailyIndex();
    this.client.index({ index, document: entry }).catch((err: unknown) => {
      // Log locally but never propagate – shipping must not affect the request.
      this.logger.warn(`Log shipping failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Returns the rolling daily index name, e.g. `teachlink-logs-2026.04.26`. */
  private dailyIndex(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${LOG_INDEX_PREFIX}-${yyyy}.${mm}.${dd}`;
  }

  /**
   * Creates (or updates) an Elasticsearch index template so all future daily
   * log indices inherit consistent field mappings and settings.
   */
  private async ensureIndexTemplate(): Promise<void> {
    await this.client!.indices.putIndexTemplate({
      name: LOG_INDEX_TEMPLATE,
      index_patterns: [`${LOG_INDEX_PREFIX}-*`],
      ...LOG_INDEX_MAPPINGS,
      priority: 100,
    });
    this.logger.log(`Elasticsearch log index template '${LOG_INDEX_TEMPLATE}' registered`);
  }
}
