import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

/**
 * Enforces API versioning policy at runtime.
 *
 * - Requests to **sunset** versions receive `410 Gone` with a migration link.
 * - Requests to **deprecated** (grace-period) versions pass through but carry
 *   `Deprecation: true` and `Sunset: <ISO date>` response headers so clients
 *   can discover the end-of-life date automatically.
 * - Requests to non-versioned paths are unaffected.
 *
 * Configuration is driven by two environment variables:
 *
 * | Variable              | Format                              | Example                          |
 * |-----------------------|-------------------------------------|----------------------------------|
 * | `SUNSET_VERSIONS`     | Comma-separated `version:ISO-date`  | `v1:2024-01-01,v2:2024-06-01`   |
 * | `DEPRECATED_VERSIONS` | Comma-separated `version:ISO-date`  | `v3:2025-01-01`                  |
 *
 * The `version` token is matched against the **first path segment** of the URL,
 * e.g. `/v1/users` → version token `v1`.
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiVersionMiddleware.name);

  /** Map of version → sunset date for fully retired versions. */
  private readonly sunsetVersions: Map<string, Date>;
  /** Map of version → sunset date for deprecated-but-still-active versions. */
  private readonly deprecatedVersions: Map<string, Date>;
  /** URL to migration documentation returned in 410 responses. */
  private readonly migrationDocsUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.sunsetVersions = this.parseVersionDates(
      this.configService.get<string>('SUNSET_VERSIONS', ''),
    );
    this.deprecatedVersions = this.parseVersionDates(
      this.configService.get<string>('DEPRECATED_VERSIONS', ''),
    );
    this.migrationDocsUrl = this.configService.get<string>(
      'API_MIGRATION_DOCS_URL',
      'https://docs.teachlink.io/api/migration',
    );
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const version = this.extractVersion(req.path);

    if (!version) {
      return next();
    }

    if (this.sunsetVersions.has(version)) {
      const sunsetDate = this.sunsetVersions.get(version)!;
      this.logger.warn(`Rejected request to sunset version ${version}: ${req.method} ${req.path}`);

      res.setHeader('Sunset', sunsetDate.toUTCString());
      res.setHeader('Link', `<${this.migrationDocsUrl}>; rel="successor-version"`);
      res.status(410).json({
        statusCode: 410,
        error: 'Gone',
        message: `API version ${version} has been sunset as of ${sunsetDate.toISOString()}. Please migrate to a supported version. Migration guide: ${this.migrationDocsUrl}`,
        sunsetDate: sunsetDate.toISOString(),
        migrationDocs: this.migrationDocsUrl,
      });
      return;
    }

    if (this.deprecatedVersions.has(version)) {
      const sunsetDate = this.deprecatedVersions.get(version)!;
      this.logger.warn(
        `Request to deprecated version ${version} (sunset: ${sunsetDate.toISOString()}): ${req.method} ${req.path}`,
      );

      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', sunsetDate.toUTCString());
      res.setHeader('Link', `<${this.migrationDocsUrl}>; rel="successor-version"`);
    }

    next();
  }

  /**
   * Extracts the version token from the first path segment.
   * Matches tokens like `v1`, `v2`, `v10`, etc.
   * Returns `null` when the path does not start with a versioned segment.
   */
  extractVersion(path: string): string | null {
    const match = /^\/?(v\d+)\//i.exec(path) ?? /^\/?(v\d+)$/i.exec(path);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Parses a comma-separated list of `version:ISO-date` pairs into a Map.
   * Silently skips malformed entries and logs a warning.
   *
   * @example `"v1:2024-01-01,v2:2024-06-01"` → Map { "v1" → Date, "v2" → Date }
   */
  private parseVersionDates(raw: string): Map<string, Date> {
    const result = new Map<string, Date>();

    if (!raw || !raw.trim()) {
      return result;
    }

    for (const entry of raw.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) {
        this.logger.warn(`Skipping malformed version entry (missing colon): "${trimmed}"`);
        continue;
      }

      const version = trimmed.slice(0, colonIndex).trim().toLowerCase();
      const dateStr = trimmed.slice(colonIndex + 1).trim();
      const parsed = new Date(dateStr);

      if (isNaN(parsed.getTime())) {
        this.logger.warn(`Skipping malformed version entry (invalid date): "${trimmed}"`);
        continue;
      }

      result.set(version, parsed);
    }

    return result;
  }
}
