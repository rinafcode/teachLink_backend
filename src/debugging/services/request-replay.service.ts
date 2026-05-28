import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestCaptureService } from './request-capture.service';
import { IReplayOptions, IReplayResult } from '../interfaces/debug.interfaces';

/**
 * Re-issues a previously captured request against the running service (or any
 * supplied base URL) so a developer can reproduce a bug deterministically and
 * compare the new response to the original.
 */
@Injectable()
export class RequestReplayService {
  private readonly logger = new Logger(RequestReplayService.name);

  /** Default target — the locally running instance. */
  private readonly selfBaseUrl =
    process.env.DEBUG_REPLAY_BASE_URL ??
    `http://127.0.0.1:${process.env.PORT ?? 3000}`;

  // Headers that must never be replayed verbatim because they describe the
  // original transport, not the logical request.
  private static readonly STRIPPED_HEADERS = [
    'host',
    'content-length',
    'connection',
    'accept-encoding',
  ];

  constructor(private readonly capture: RequestCaptureService) {}

  /**
   * Replay the captured record identified by `id`.
   * @throws NotFoundException when the record is no longer buffered.
   */
  async replay(id: string, options: IReplayOptions = {}): Promise<IReplayResult> {
    const record = this.capture.get(id);
    if (!record) {
      throw new NotFoundException(`No captured request with id "${id}"`);
    }

    const baseUrl = options.baseUrl ?? this.selfBaseUrl;
    const target = `${baseUrl.replace(/\/$/, '')}${record.request.path}`;
    const url = new URL(target);
    for (const [key, value] of Object.entries(record.request.query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const headers = this.buildHeaders(record.request.headers, options.headerOverrides);
    const body = options.bodyOverride ?? record.request.body;
    const method = record.request.method.toUpperCase();
    const hasBody = body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD';

    const start = process.hrtime.bigint();
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: hasBody ? this.serialiseBody(body, headers) : undefined,
    });
    const durationMs =
      Math.round(Number(process.hrtime.bigint() - start) / 1e3) / 1e3;

    const responseBody = await this.readBody(response);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => (responseHeaders[key] = value));

    this.logger.debug(
      `Replayed ${method} ${record.request.path} → ${response.status} in ${durationMs}ms`,
    );

    const originalStatus = record.response?.statusCode;
    return {
      sourceId: id,
      target: url.toString(),
      statusCode: response.status,
      durationMs,
      headers: responseHeaders,
      body: responseBody,
      diff: {
        replayedStatus: response.status,
        originalStatus,
        statusChanged:
          originalStatus !== undefined && originalStatus !== response.status,
      },
    };
  }

  private buildHeaders(
    captured: Record<string, string>,
    overrides?: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(captured)) {
      if (RequestReplayService.STRIPPED_HEADERS.includes(key.toLowerCase())) {
        continue;
      }
      // Redacted values cannot be replayed; drop them so the caller can supply
      // a fresh credential via overrides.
      if (value === '[REDACTED]') continue;
      headers[key] = value;
    }
    return { ...headers, ...overrides };
  }

  private serialiseBody(body: unknown, headers: Record<string, string>): string {
    if (typeof body === 'string') return body;
    const contentType = Object.entries(headers).find(
      ([k]) => k.toLowerCase() === 'content-type',
    )?.[1];
    if (!contentType || contentType.includes('application/json')) {
      headers['content-type'] = headers['content-type'] ?? 'application/json';
      return JSON.stringify(body);
    }
    return String(body);
  }

  private async readBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return undefined;
      }
    }
    return response.text();
  }
}
