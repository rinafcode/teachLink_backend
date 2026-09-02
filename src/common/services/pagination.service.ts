import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';

export interface CursorPayload {
  id: string;
  createdAt: string;
}

export function encodeCursor(id: string, createdAt: Date | string): string {
  const dateStr = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
  const payload: CursorPayload = { id, createdAt: dateStr };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const payload = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed.id === 'string' && parsed.createdAt) {
      return { id: parsed.id, createdAt: String(parsed.createdAt) };
    }
    return null;
  } catch {
    return null;
  }
}

export interface PaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  cursor?: string;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

@Injectable()
export class PaginationService {
  encodeCursor(id: string, createdAt: Date | string): string {
    return encodeCursor(id, createdAt);
  }

  decodeCursor(cursor: string): CursorPayload | null {
    return decodeCursor(cursor);
  }

  async paginate<T>(
    qb: SelectQueryBuilder<T>,
    cursor?: string,
    limit: number = 20,
    offset?: number,
    dateColumn: string = 'createdAt',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginationResult<T>> {
    const alias = qb.alias;
    const normalizedOrder = order === 'ASC' ? 'ASC' : 'DESC';
    const cursorOp = normalizedOrder === 'DESC' ? '<' : '>';

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const cursorDate = new Date(decoded.createdAt);
        const cursorId = decoded.id;

        qb.andWhere(
          `(${alias}.${dateColumn} ${cursorOp} :cursorDate OR (${alias}.${dateColumn} = :cursorDate AND ${alias}.id ${cursorOp} :cursorId))`,
          { cursorDate, cursorId },
        );
      }

      qb.orderBy(`${alias}.${dateColumn}`, normalizedOrder as 'ASC' | 'DESC').addOrderBy(
        `${alias}.id`,
        normalizedOrder as 'ASC' | 'DESC',
      );
      qb.take(limit + 1);

      const items = await qb.getMany();
      const hasMore = items.length > limit;
      const data = hasMore ? items.slice(0, limit) : items;

      const lastItem = data.length > 0 ? data[data.length - 1] : null;
      const nextCursor =
        hasMore && lastItem
          ? encodeCursor(
              (lastItem as any).id,
              (lastItem as any)[dateColumn] ?? (lastItem as any).createdAt,
            )
          : null;

      return {
        data,
        nextCursor,
        cursor,
      };
    } else {
      const page = offset !== undefined ? Math.floor(offset / limit) + 1 : 1;
      const skip = offset !== undefined ? offset : (page - 1) * limit;

      qb.orderBy(`${alias}.${dateColumn}`, normalizedOrder as 'ASC' | 'DESC').addOrderBy(
        `${alias}.id`,
        normalizedOrder as 'ASC' | 'DESC',
      );
      qb.skip(skip).take(limit);

      const [data, total] = await qb.getManyAndCount();
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = skip + data.length < total;
      const hasPrevPage = skip > 0;

      const lastItem = data.length > 0 ? data[data.length - 1] : null;
      const nextCursor =
        hasNextPage && lastItem
          ? encodeCursor(
              (lastItem as any).id,
              (lastItem as any)[dateColumn] ?? (lastItem as any).createdAt,
            )
          : null;

      return {
        data,
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextCursor,
      };
    }
  }
}
