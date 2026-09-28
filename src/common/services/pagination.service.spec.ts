import { PaginationService, encodeCursor, decodeCursor } from './pagination.service';

describe('PaginationService', () => {
  let service: PaginationService;

  beforeEach(() => {
    service = new PaginationService();
  });

  describe('encodeCursor / decodeCursor', () => {
    it('should encode and decode cursor correctly', () => {
      const id = 'course-123';
      const date = new Date('2026-07-26T12:00:00.000Z');

      const encoded = encodeCursor(id, date);
      expect(typeof encoded).toBe('string');

      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual({
        id,
        createdAt: '2026-07-26T12:00:00.000Z',
      });
    });

    it('should return null for invalid cursor', () => {
      expect(decodeCursor('invalid-base64!!!')).toBeNull();
    });
  });

  describe('paginate', () => {
    it('should handle offset mode correctly when cursor is not provided', async () => {
      const mockData = [
        { id: '1', createdAt: new Date('2026-01-01') },
        { id: '2', createdAt: new Date('2026-01-02') },
      ];
      const mockQb = {
        alias: 'entity',
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockData, 5]),
      } as any;

      const result = await service.paginate(mockQb, undefined, 2, 0);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.nextCursor).not.toBeNull();
    });

    it('should handle cursor mode when cursor is provided', async () => {
      const cursor = encodeCursor('1', new Date('2026-01-01'));
      const mockItems = [
        { id: '2', createdAt: new Date('2026-01-02') },
        { id: '3', createdAt: new Date('2026-01-03') },
        { id: '4', createdAt: new Date('2026-01-04') },
      ];
      const mockQb = {
        alias: 'entity',
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockItems),
      } as any;

      const result = await service.paginate(mockQb, cursor, 2);
      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });
  });
});
