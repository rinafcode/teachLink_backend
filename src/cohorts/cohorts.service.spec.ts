import { CohortsService } from './cohorts.service';
import { buildOffsetResponse, clampLimit } from '../common/utils/pagination.utils';

describe('CohortsService', () => {
  let service: CohortsService;
  let mockCohortRepo: any;
  let mockMemberRepo: any;
  let mockThreadRepo: any;
  let mockCommentRepo: any;
  let mockAssignmentRepo: any;

  const mockMembership = { id: 'mem-1', cohortId: 'cohort-1', userId: 'user-1', role: 'member' };
  const mockMember = {
    id: 'm-1',
    cohortId: 'cohort-1',
    userId: 'user-2',
    role: 'member',
    createdAt: new Date(),
  };
  const mockThread = {
    id: 't-1',
    cohortId: 'cohort-1',
    authorId: 'user-2',
    title: 'Thread',
    content: 'Content',
    createdAt: new Date(),
  };
  const mockAssignment = {
    id: 'a-1',
    cohortId: 'cohort-1',
    title: 'Assignment',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockCohortRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (data) => ({ id: 'cohort-1', ...data })),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    mockMemberRepo = {
      findOne: jest.fn().mockResolvedValue(mockMembership),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (data) => ({ id: 'new-id', ...data })),
      findAndCount: jest.fn().mockResolvedValue([[mockMember], 1]),
    };

    mockThreadRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (data) => ({ id: 'new-id', ...data })),
      findAndCount: jest.fn().mockResolvedValue([[mockThread], 1]),
    };

    mockCommentRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (data) => ({ id: 'new-id', ...data })),
    };

    mockAssignmentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (data) => ({ id: 'new-id', ...data })),
      findAndCount: jest.fn().mockResolvedValue([[mockAssignment], 1]),
    };

    service = new CohortsService(
      mockCohortRepo,
      mockMemberRepo,
      mockThreadRepo,
      mockCommentRepo,
      mockAssignmentRepo,
    );

    mockCohortRepo.findOne.mockResolvedValue({ id: 'cohort-1', ownerId: 'user-1' });
  });

  describe('listMembers', () => {
    it('should return paginated members with default page size', async () => {
      mockMemberRepo.findAndCount.mockResolvedValue([[mockMember], 1]);

      const result = await service.listMembers('cohort-1', 'user-1');

      expect(result.data).toEqual([mockMember]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(mockMemberRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('should respect custom page and limit', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        ...mockMember,
        id: `m-${i + 1}`,
        createdAt: new Date(),
      }));
      mockMemberRepo.findAndCount.mockResolvedValue([items, 25]);

      const result = await service.listMembers('cohort-1', 'user-1', { page: 2, limit: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(5);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
      expect(mockMemberRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('should enforce max page size via clampLimit', async () => {
      mockMemberRepo.findAndCount.mockResolvedValue([[mockMember], 1]);

      await service.listMembers('cohort-1', 'user-1', { page: 1, limit: 999 });

      expect(mockMemberRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should return first page when no query is provided', async () => {
      mockMemberRepo.findAndCount.mockResolvedValue([[mockMember], 1]);

      const result = await service.listMembers('cohort-1', 'user-1', undefined);

      expect(result.page).toBe(1);
      expect(mockMemberRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('should reject non-members with ForbiddenException', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(service.listMembers('cohort-1', 'user-2')).rejects.toThrow('Access denied');
    });
  });

  describe('listThreads', () => {
    it('should return paginated threads ordered by createdAt DESC', async () => {
      mockThreadRepo.findAndCount.mockResolvedValue([[mockThread], 1]);

      const result = await service.listThreads('cohort-1', 'user-1', { page: 1, limit: 10 });

      expect(result.data).toEqual([mockThread]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(mockThreadRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cohortId: 'cohort-1' },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('listAssignments', () => {
    it('should return paginated assignments ordered by createdAt DESC', async () => {
      mockAssignmentRepo.findAndCount.mockResolvedValue([[mockAssignment], 1]);

      const result = await service.listAssignments('cohort-1', 'user-1', { page: 1, limit: 10 });

      expect(result.data).toEqual([mockAssignment]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(mockAssignmentRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cohortId: 'cohort-1' },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('clampLimit', () => {
    it('should default to DEFAULT_PAGE_SIZE when limit is undefined', () => {
      expect(clampLimit(undefined)).toBe(10);
    });

    it('should cap at MAX_PAGE_SIZE', () => {
      expect(clampLimit(200)).toBe(100);
    });

    it('should enforce minimum of 1', () => {
      expect(clampLimit(0)).toBe(1);
    });
  });
});
