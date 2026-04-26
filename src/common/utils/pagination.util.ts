import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import {
  PaginationQueryDto,
  SortOrder,
  CursorPaginationQueryDto,
  CursorDirection,
} from '../dto/pagination.dto';
import { APP_CONSTANTS } from '../constants/app.constants';

const { DEFAULT_PAGE_SIZE } = APP_CONSTANTS;

export interface IPaginatedResponse<T> {
  data: T[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface ICursorPaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
}

export async function paginate<T>(
  queryBuilder: SelectQueryBuilder<T>,
  options: PaginationQueryDto,
): Promise<IPaginatedResponse<T>> {
  const page = options.page || 1;
  const limit = options.limit || DEFAULT_PAGE_SIZE;
  const skip = (page - 1) * limit;

  // Apply sorting
  if (options.sortBy) {
    const alias = queryBuilder.alias;
    queryBuilder.orderBy(`${alias}.${options.sortBy}`, options.order);
  }

  // Clone query to get count without pagination limits
  const totalItems = await queryBuilder.getCount();

  // Apply pagination
  const data = await queryBuilder.skip(skip).take(limit).getMany();

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data,
    meta: {
      totalItems,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages,
      currentPage: page,
    },
  };
}

/**
 * Encodes entity fields into a base64 opaque cursor string.
 * The cursor captures the sort field value and the entity id for stable pagination.
 */
export function generateCursor(entity: Record<string, any>, sortBy: string): string {
  const cursorData = { id: entity.id, sortValue: entity[sortBy] };
  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

/**
 * Decodes a cursor string back to its constituent fields.
 * Throws BadRequestException if the cursor is malformed or missing required fields.
 */
export function decodeCursor(cursor: string): { id: string; sortValue: any } {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const data = JSON.parse(json);
    if (typeof data.id !== 'string' || data.sortValue === undefined) {
      throw new BadRequestException('Invalid cursor structure');
    }
    return data;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Invalid cursor value');
  }
}

/**
 * Returns true if the cursor can be decoded without errors, false otherwise.
 */
export function validateCursor(cursor: string): boolean {
  try {
    decodeCursor(cursor);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cursor-based pagination for TypeORM query builders.
 *
 * Supports bidirectional navigation:
 * - direction=forward (default): fetch items after the cursor (newer → older for DESC)
 * - direction=backward: fetch items before the cursor, reversing results to natural order
 *
 * The cursor encodes {id, sortValue} of a boundary item so pages stay stable even
 * as new records are inserted.
 */
export async function paginateWithCursor<T extends Record<string, any>>(
  queryBuilder: SelectQueryBuilder<T>,
  options: CursorPaginationQueryDto,
): Promise<ICursorPaginatedResponse<T>> {
  const limit = options.limit || DEFAULT_PAGE_SIZE;
  const sortBy = options.sortBy || 'createdAt';
  const order = options.order || SortOrder.DESC;
  const direction = options.direction || CursorDirection.FORWARD;
  const alias = queryBuilder.alias;

  const isForward = direction === CursorDirection.FORWARD;
  const isDesc = order === SortOrder.DESC;

  if (options.cursor) {
    const { id: cursorId, sortValue } = decodeCursor(options.cursor);

    // Determine the comparison operator for WHERE clause:
    //   Forward  + DESC → get items older than cursor  → primary field uses '<'
    //   Forward  + ASC  → get items newer than cursor  → primary field uses '>'
    //   Backward + DESC → get items newer than cursor  → primary field uses '>'
    //   Backward + ASC  → get items older than cursor  → primary field uses '<'
    const useGreaterThan = (isForward && !isDesc) || (!isForward && isDesc);
    const op = useGreaterThan ? '>' : '<';

    queryBuilder.andWhere(
      `(${alias}.${sortBy} ${op} :sortValue` +
        ` OR (${alias}.${sortBy} = :sortValue AND ${alias}.id ${op} :cursorId))`,
      { sortValue, cursorId },
    );
  }

  // For backward pagination the sort is inverted so we retrieve the nearest items;
  // results are reversed after fetch to restore natural reading order.
  const effectiveOrder: SortOrder = isForward ? order : isDesc ? SortOrder.ASC : SortOrder.DESC;
  const effectiveIdOrder: SortOrder = isForward
    ? isDesc
      ? SortOrder.DESC
      : SortOrder.ASC
    : isDesc
      ? SortOrder.ASC
      : SortOrder.DESC;

  queryBuilder
    .orderBy(`${alias}.${sortBy}`, effectiveOrder)
    .addOrderBy(`${alias}.id`, effectiveIdOrder);

  // Fetch one extra item to determine whether another page exists in this direction
  const rawItems = await queryBuilder.take(limit + 1).getMany();
  const hasMore = rawItems.length > limit;
  const pageData = rawItems.slice(0, limit);

  if (!isForward) {
    pageData.reverse();
  }

  // nextCursor points to the last item on this page (used to paginate forward)
  const nextCursor =
    pageData.length > 0 && (isForward ? hasMore : !!options.cursor)
      ? generateCursor(pageData[pageData.length - 1], sortBy)
      : null;

  // prevCursor points to the first item on this page (used to paginate backward)
  const prevCursor =
    pageData.length > 0 && (!isForward ? hasMore : !!options.cursor)
      ? generateCursor(pageData[0], sortBy)
      : null;

  return {
    data: pageData,
    meta: {
      nextCursor,
      prevCursor,
      hasNextPage: isForward ? hasMore : !!options.cursor,
      hasPrevPage: !isForward ? hasMore : !!options.cursor,
      limit,
    },
  };
}
