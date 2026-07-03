import { APP_CONSTANTS } from '../constants/app.constants';
import {
  CursorPaginatedResponse,
  OffsetPaginatedResponse,
} from '../interfaces/pagination.interface';

const { MAX_PAGE_SIZE } = APP_CONSTANTS;

export function clampLimit(limit: number | undefined, max = MAX_PAGE_SIZE): number {
  const value = limit ?? APP_CONSTANTS.DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, value), max);
}

export function encodeCursor(id: string, date: Date): string {
  const payload = JSON.stringify({ id, date: date.toISOString() });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { id: string; date: Date } | null {
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(payload) as { id: string; date: string };
    return { id: parsed.id, date: new Date(parsed.date) };
  } catch {
    return null;
  }
}

export function buildCursorResponse<T extends { id: string; createdAt: Date }>(
  items: T[],
  requestedLimit: number,
): CursorPaginatedResponse<T> {
  const limit = clampLimit(requestedLimit);
  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;

  const startCursor = data.length > 0 ? encodeCursor(data[0].id, data[0].createdAt) : null;
  const endCursor =
    data.length > 0
      ? encodeCursor(data[data.length - 1].id, data[data.length - 1].createdAt)
      : null;

  return {
    data,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: false,
      startCursor,
      endCursor,
    },
  };
}

export function buildOffsetResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): OffsetPaginatedResponse<T> {
  const clampedLimit = clampLimit(limit);
  const totalPages = Math.ceil(total / clampedLimit);
  return {
    data,
    total,
    page,
    limit: clampedLimit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
