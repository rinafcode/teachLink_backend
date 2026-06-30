import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { AxiosError, AxiosResponse } from 'axios';
import {
  ExternalModerationProvider,
  ExternalModerationUnavailableError,
  ModerationScore,
} from './external-moderation.provider';

interface OpenAIModerationCategories {
  [category: string]: boolean;
}

interface OpenAIModerationCategoryScores {
  [category: string]: number;
}

interface OpenAIModerationResult {
  flagged?: boolean;
  categories?: OpenAIModerationCategories;
  category_scores?: OpenAIModerationCategoryScores;
}

interface OpenAIModerationResponse {
  results?: OpenAIModerationResult[];
}

/**
 * Issue #805 — OpenAI moderation adapter.
 *
 * Calls `POST /v1/moderations` and translates the response into a single
 * [0, 1] {@link ModerationScore}. The mapping is intentionally simple: take the
 * max of `category_scores` (the highest-confidence category drives the score).
 * When the response is shape-malformed we treat it as unavailability rather than
 * "safe", because false negatives are worse than degraded UX.
 *
 * Any failure mode (missing key, timeout, HTTP error, malformed response) is
 * converted into {@link ExternalModerationUnavailableError} so the caller can
 * fall back to the keyword filter without a 500.
 */
@Injectable()
export class OpenAiModerationAdapter implements ExternalModerationProvider {
  public readonly name = 'openai-moderation';

  private readonly logger = new Logger(OpenAiModerationAdapter.name);
  private readonly endpoint = 'https://api.openai.com/v1/moderations';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async scoreContent(text: string): Promise<ModerationScore> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const timeoutMs = this.configService.get<number>(
      'OPENAI_MODERATION_TIMEOUT_MS',
      500,
    );

    if (!apiKey) {
      throw new ExternalModerationUnavailableError(
        'OPENAI_API_KEY is not configured',
      );
    }
    if (typeof text !== 'string' || text.length === 0) {
      return 0;
    }

    let response: AxiosResponse<OpenAIModerationResponse>;
    try {
      response = await firstValueFrom(
        this.httpService
          .post<OpenAIModerationResponse>(
            this.endpoint,
            { input: text },
            { headers: { Authorization: `Bearer ${apiKey}` } },
          )
          .pipe(
            timeout(timeoutMs),
            catchError((err) => {
              if (err instanceof TimeoutError) {
                return throwError(
                  () =>
                    new ExternalModerationUnavailableError(
                      `OpenAI moderation timed out after ${timeoutMs}ms`,
                      err,
                    ),
                );
              }
              if (err instanceof AxiosError) {
                return throwError(
                  () =>
                    new ExternalModerationUnavailableError(
                      `OpenAI moderation HTTP error (${err.response?.status ?? 'no-status'}): ${err.message}`,
                      err,
                    ),
                );
              }
              return throwError(
                () =>
                  new ExternalModerationUnavailableError(
                    `OpenAI moderation failed: ${(err as Error).message}`,
                    err,
                  ),
              );
            }),
          ),
      );
    } catch (err) {
      if (err instanceof ExternalModerationUnavailableError) {
        throw err;
      }
      throw new ExternalModerationUnavailableError(
        `OpenAI moderation unexpected error: ${(err as Error).message}`,
        err,
      );
    }

    const result = response.data?.results?.[0];
    if (!result) {
      // Treat empty results as unavailability — better to false-positive than
      // to silently approve everything because the provider changed shape.
      throw new ExternalModerationUnavailableError(
        'OpenAI moderation returned no results array',
      );
    }

    const scores = Object.values(result.category_scores ?? {});
    if (scores.length === 0) {
      // No per-category scores — fall back to the boolean flag with half-weight.
      return result.flagged === true ? 0.8 : 0;
    }
    const maxScore = scores.reduce((acc, v) => (v > acc ? v : acc), 0);
    return clamp01(maxScore);
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
