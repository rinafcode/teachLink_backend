import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ManualReviewService } from '../manual/manual-review.service';
import { ContentReportReason } from './content-report-reason.enum';
import { ContentReportStatus } from './content-report-status.enum';
import { ContentReport } from './content-report.entity';
import { ContentReportingService } from './content-reporting.service';
import { ContentReportDisposition } from './dto/review-content-report.dto';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockManualReviewService = {
  enqueue: jest.fn(),
  markReviewed: jest.fn(),
};

describe('ContentReportingService', () => {
  let service: ContentReportingService;

  const reporter = {
    id: 'reporter-1',
    roles: [{ name: 'student' }],
  } as any;

  const moderator = {
    id: 'moderator-1',
    roles: [{ name: 'moderator' }],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentReportingService,
        { provide: getRepositoryToken(ContentReport), useValue: mockRepo },
        { provide: ManualReviewService, useValue: mockManualReviewService },
      ],
    }).compile();

    service = module.get<ContentReportingService>(ContentReportingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportContent', () => {
    it('should persist the report and enqueue it for moderation', async () => {
      const savedReport = {
        id: 'report-1',
        contentType: 'course',
        contentId: 'course-1',
        reason: ContentReportReason.SPAM,
        details: 'Spam links',
        reporterId: reporter.id,
        status: ContentReportStatus.PENDING,
      };

      mockRepo.create.mockReturnValue(savedReport);
      mockRepo.save.mockResolvedValueOnce(savedReport).mockResolvedValueOnce({
        ...savedReport,
        moderationItemId: 42,
      });
      mockManualReviewService.enqueue.mockResolvedValue({ id: 42 });

      const result = await service.reportContent(
        {
          contentType: 'course',
          contentId: 'course-1',
          reason: ContentReportReason.SPAM,
          details: 'Spam links',
        },
        reporter,
      );

      expect(mockRepo.create).toHaveBeenCalledWith({
        contentType: 'course',
        contentId: 'course-1',
        reason: ContentReportReason.SPAM,
        details: 'Spam links',
        reporterId: reporter.id,
        status: ContentReportStatus.PENDING,
      });
      expect(mockManualReviewService.enqueue).toHaveBeenCalledWith(
        expect.stringContaining('type=course'),
        expect.any(Number),
        {
          sourceType: 'content-report',
          sourceId: 'report-1',
          reportId: 'report-1',
        },
      );
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ ...savedReport, moderationItemId: 42 });
    });
  });

  describe('listReports', () => {
    it('should return reports for privileged users', async () => {
      mockRepo.find.mockResolvedValue([{ id: 'report-1' }]);

      const result = await service.listReports(
        { status: ContentReportStatus.PENDING, limit: 25 },
        moderator,
      );

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { status: ContentReportStatus.PENDING },
        order: { createdAt: 'DESC' },
        take: 25,
      });
      expect(result).toEqual([{ id: 'report-1' }]);
    });

    it('should reject non-moderators', async () => {
      await expect(service.listReports({ limit: 10 }, reporter)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getReportById', () => {
    it('should return the report for the owner', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'report-1',
        reporterId: reporter.id,
      });

      const result = await service.getReportById('report-1', reporter);

      expect(result).toEqual({
        id: 'report-1',
        reporterId: reporter.id,
      });
    });

    it('should throw when the report does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getReportById('missing', reporter)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reviewReport', () => {
    it('should finalize the report and mark the queue item reviewed', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'report-1',
        status: ContentReportStatus.PENDING,
        moderationItemId: 42,
      });
      mockRepo.save.mockResolvedValue({
        id: 'report-1',
        status: ContentReportStatus.RESOLVED,
        moderationItemId: 42,
        reviewerId: moderator.id,
      });

      const result = await service.reviewReport(
        'report-1',
        {
          disposition: ContentReportDisposition.RESOLVE,
          resolutionNote: 'Confirmed spam.',
        },
        moderator,
      );

      expect(mockManualReviewService.markReviewed).toHaveBeenCalledWith(42);
      expect(result.status).toBe(ContentReportStatus.RESOLVED);
      expect(result.reviewerId).toBe(moderator.id);
    });

    it('should reject finalized reports', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'report-1',
        status: ContentReportStatus.RESOLVED,
        moderationItemId: 42,
      });

      await expect(
        service.reviewReport(
          'report-1',
          {
            disposition: ContentReportDisposition.DISMISS,
          },
          moderator,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
