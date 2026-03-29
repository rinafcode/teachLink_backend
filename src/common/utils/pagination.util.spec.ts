import { BadRequestException } from '@nestjs/common';
import {
  generateCursor,
  decodeCursor,
  validateCursor,
  paginateWithCursor,
  paginate,
} from './pagination.util';
import { SortOrder, CursorDirection } from '../dto/pagination.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockQueryBuilder(items: any[]) {
  const qb: any = {
    alias: 'entity',
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(items.length),
    getMany: jest.fn().mockResolvedValue(items),
  };
  return qb;
}

function makeItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${String(i + 1).padStart(3, '0')}`,
    createdAt: new Date(2024, 0, count - i).toISOString(),
    title: `Course ${i + 1}`,
  }));
}

// ---------------------------------------------------------------------------
// generateCursor
// ---------------------------------------------------------------------------

describe('generateCursor', () => {
  it('produces a non-empty base64 string', () => {
    const entity = { id: 'abc-123', createdAt: '2024-06-01T00:00:00.000Z' };
    const cursor = generateCursor(entity, 'createdAt');
    expect(typeof cursor).toBe('string');
    expect(cursor.length).toBeGreaterThan(0);
  });

  it('encodes id and sortValue', () => {
    const entity = { id: 'uuid-x', createdAt: '2024-06-01T00:00:00.000Z' };
    const cursor = generateCursor(entity, 'createdAt');
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    expect(decoded.id).toBe('uuid-x');
    expect(decoded.sortValue).toBe('2024-06-01T00:00:00.000Z');
  });

  it('generates different cursors for different entities', () => {
    const e1 = { id: 'id-1', createdAt: '2024-01-01' };
    const e2 = { id: 'id-2', createdAt: '2024-01-02' };
    expect(generateCursor(e1, 'createdAt')).not.toBe(generateCursor(e2, 'createdAt'));
  });

  it('generates different cursors for same createdAt but different ids', () => {
    const ts = '2024-01-01T00:00:00.000Z';
    const e1 = { id: 'id-1', createdAt: ts };
    const e2 = { id: 'id-2', createdAt: ts };
    expect(generateCursor(e1, 'createdAt')).not.toBe(generateCursor(e2, 'createdAt'));
  });
});

// ---------------------------------------------------------------------------
// decodeCursor
// ---------------------------------------------------------------------------

describe('decodeCursor', () => {
  it('round-trips correctly with generateCursor', () => {
    const entity = { id: 'test-id', createdAt: '2024-03-15T12:00:00.000Z' };
    const cursor = generateCursor(entity, 'createdAt');
    const decoded = decodeCursor(cursor);
    expect(decoded.id).toBe('test-id');
    expect(decoded.sortValue).toBe('2024-03-15T12:00:00.000Z');
  });

  it('throws BadRequestException for non-base64 input', () => {
    expect(() => decodeCursor('!!!not-base64!!!')).toThrow(BadRequestException);
  });

  it('throws BadRequestException when id field is missing', () => {
    const bad = Buffer.from(JSON.stringify({ sortValue: '2024-01-01' })).toString('base64');
    expect(() => decodeCursor(bad)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when sortValue field is missing', () => {
    const bad = Buffer.from(JSON.stringify({ id: 'some-id' })).toString('base64');
    expect(() => decodeCursor(bad)).toThrow(BadRequestException);
  });

  it('throws BadRequestException for valid base64 but invalid JSON', () => {
    const bad = Buffer.from('not json at all').toString('base64');
    expect(() => decodeCursor(bad)).toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// validateCursor
// ---------------------------------------------------------------------------

describe('validateCursor', () => {
  it('returns true for a cursor produced by generateCursor', () => {
    const cursor = generateCursor({ id: 'id-1', createdAt: '2024-01-01' }, 'createdAt');
    expect(validateCursor(cursor)).toBe(true);
  });

  it('returns false for a random string', () => {
    expect(validateCursor('garbage')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateCursor('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// paginateWithCursor — forward pagination
// ---------------------------------------------------------------------------

describe('paginateWithCursor — forward (default)', () => {
  it('returns all items and no cursors when fewer items than limit', async () => {
    const items = makeItems(3);
    const qb = buildMockQueryBuilder(items);

    const result = await paginateWithCursor(qb, { limit: 10 });

    expect(result.data).toHaveLength(3);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPrevPage).toBe(false);
    expect(result.meta.nextCursor).toBeNull();
    expect(result.meta.prevCursor).toBeNull();
    expect(result.meta.limit).toBe(10);
  });

  it('returns nextCursor and hasNextPage=true when limit+1 items returned', async () => {
    const items = makeItems(11); // limit=10 → 11th item signals more
    const qb = buildMockQueryBuilder(items);

    const result = await paginateWithCursor(qb, { limit: 10 });

    expect(result.data).toHaveLength(10);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.nextCursor).not.toBeNull();
    expect(result.meta.prevCursor).toBeNull(); // no cursor provided → first page
  });

  it('sets hasPrevPage=true and prevCursor when cursor is provided', async () => {
    const items = makeItems(5);
    const cursor = generateCursor(items[0], 'createdAt');
    const qb = buildMockQueryBuilder(items);

    const result = await paginateWithCursor(qb, { cursor, limit: 10 });

    expect(result.meta.hasPrevPage).toBe(true);
    expect(result.meta.prevCursor).not.toBeNull();
  });

  it('applies WHERE condition when cursor is provided', async () => {
    const items = makeItems(3);
    const cursor = generateCursor(items[0], 'createdAt');
    const qb = buildMockQueryBuilder(items);

    await paginateWithCursor(qb, { cursor, limit: 10 });

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    const [whereStr] = qb.andWhere.mock.calls[0];
    expect(whereStr).toContain('entity.createdAt');
    expect(whereStr).toContain('entity.id');
  });

  it('does NOT call andWhere when no cursor is provided', async () => {
    const qb = buildMockQueryBuilder(makeItems(3));

    await paginateWithCursor(qb, { limit: 10 });

    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('uses DESC operator (<) for forward DESC pagination', async () => {
    const items = makeItems(3);
    const cursor = generateCursor(items[0], 'createdAt');
    const qb = buildMockQueryBuilder(items);

    await paginateWithCursor(qb, { cursor, limit: 5, order: SortOrder.DESC });

    const [whereStr] = qb.andWhere.mock.calls[0];
    expect(whereStr).toContain('<');
  });

  it('uses ASC operator (>) for forward ASC pagination', async () => {
    const items = makeItems(3);
    const cursor = generateCursor(items[0], 'createdAt');
    const qb = buildMockQueryBuilder(items);

    await paginateWithCursor(qb, { cursor, limit: 5, order: SortOrder.ASC });

    const [whereStr] = qb.andWhere.mock.calls[0];
    expect(whereStr).toContain('>');
  });

  it('applies orderBy with the specified sortBy field', async () => {
    const qb = buildMockQueryBuilder(makeItems(2));

    await paginateWithCursor(qb, { sortBy: 'title', order: SortOrder.ASC });

    expect(qb.orderBy).toHaveBeenCalledWith('entity.title', SortOrder.ASC);
  });

  it('uses default limit of 10 when not specified', async () => {
    const qb = buildMockQueryBuilder(makeItems(0));

    const result = await paginateWithCursor(qb, {});

    expect(result.meta.limit).toBe(10);
    // take() called with limit+1
    expect(qb.take).toHaveBeenCalledWith(11);
  });
});

// ---------------------------------------------------------------------------
// paginateWithCursor — backward pagination
// ---------------------------------------------------------------------------

describe('paginateWithCursor — backward', () => {
  it('reverses results to natural order', async () => {
    // Mock returns items in reversed sort order (ASC after inversion)
    const items = [
      { id: 'id-001', createdAt: '2024-01-01' },
      { id: 'id-002', createdAt: '2024-01-02' },
      { id: 'id-003', createdAt: '2024-01-03' },
    ];
    const cursor = generateCursor({ id: 'id-004', createdAt: '2024-01-04' }, 'createdAt');
    const qb = buildMockQueryBuilder(items);

    const result = await paginateWithCursor(qb, {
      cursor,
      limit: 10,
      direction: CursorDirection.BACKWARD,
    });

    // Reversed: [id-003, id-002, id-001]
    expect(result.data[0].id).toBe('id-003');
    expect(result.data[2].id).toBe('id-001');
  });

  it('sets hasNextPage=true when cursor is provided on backward navigation', async () => {
    const items = makeItems(3);
    const cursor = generateCursor(items[0], 'createdAt');
    const qb = buildMockQueryBuilder(items);

    const result = await paginateWithCursor(qb, {
      cursor,
      limit: 10,
      direction: CursorDirection.BACKWARD,
    });

    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.nextCursor).not.toBeNull();
  });

  it('sets hasPrevPage=true and prevCursor when limit+1 items returned', async () => {
    const items = makeItems(11);
    const cursor = generateCursor(items[0], 'createdAt');
    const qb = buildMockQueryBuilder(items);

    const result = await paginateWithCursor(qb, {
      cursor,
      limit: 10,
      direction: CursorDirection.BACKWARD,
    });

    expect(result.data).toHaveLength(10);
    expect(result.meta.hasPrevPage).toBe(true);
    expect(result.meta.prevCursor).not.toBeNull();
  });

  it('inverts sort order for backward direction (DESC → ASC)', async () => {
    const cursor = generateCursor({ id: 'id-x', createdAt: '2024-01-10' }, 'createdAt');
    const qb = buildMockQueryBuilder([]);

    await paginateWithCursor(qb, {
      cursor,
      limit: 5,
      order: SortOrder.DESC,
      direction: CursorDirection.BACKWARD,
    });

    expect(qb.orderBy).toHaveBeenCalledWith('entity.createdAt', SortOrder.ASC);
  });

  it('uses > operator for backward DESC pagination', async () => {
    const items = makeItems(2);
    const cursor = generateCursor(items[0], 'createdAt');
    const qb = buildMockQueryBuilder(items);

    await paginateWithCursor(qb, {
      cursor,
      limit: 5,
      order: SortOrder.DESC,
      direction: CursorDirection.BACKWARD,
    });

    const [whereStr] = qb.andWhere.mock.calls[0];
    expect(whereStr).toContain('>');
  });
});

// ---------------------------------------------------------------------------
// paginate (offset-based — regression)
// ---------------------------------------------------------------------------

describe('paginate (offset-based)', () => {
  it('returns correct metadata for a given page', async () => {
    const allItems = makeItems(25);
    const pageItems = allItems.slice(10, 20);
    const qb = buildMockQueryBuilder(pageItems);
    qb.getCount.mockResolvedValue(25);

    const result = await paginate(qb, { page: 2, limit: 10 });

    expect(result.meta.totalItems).toBe(25);
    expect(result.meta.currentPage).toBe(2);
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.itemsPerPage).toBe(10);
    expect(result.meta.itemCount).toBe(pageItems.length);
  });

  it('applies skip and take correctly', async () => {
    const qb = buildMockQueryBuilder([]);
    qb.getCount.mockResolvedValue(0);

    await paginate(qb, { page: 3, limit: 5 });

    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(5);
  });

  it('defaults to page 1 and limit 10', async () => {
    const qb = buildMockQueryBuilder([]);
    qb.getCount.mockResolvedValue(0);

    const result = await paginate(qb, {});

    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.itemsPerPage).toBe(10);
  });
});
