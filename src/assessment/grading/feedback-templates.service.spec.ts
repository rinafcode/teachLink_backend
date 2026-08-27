import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FeedbackTemplatesService } from './feedback-templates.service';
import { FeedbackTemplate } from './entities/feedback-template.entity';

describe('FeedbackTemplatesService', () => {
  let service: FeedbackTemplatesService;
  let repo: jest.Mocked<Repository<FeedbackTemplate>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackTemplatesService,
        {
          provide: getRepositoryToken(FeedbackTemplate),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeedbackTemplatesService>(FeedbackTemplatesService);
    repo = module.get(getRepositoryToken(FeedbackTemplate));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates and saves a template with defaults applied', async () => {
      const dto = { name: 'Standard', body: 'Score: {{score}}' };
      const built = { ...dto, isDefault: false, ownerId: 'owner-1' };
      repo.create.mockReturnValue(built as FeedbackTemplate);
      repo.save.mockResolvedValue({ id: 't1', ...built } as FeedbackTemplate);

      const result = await service.create(dto, 'owner-1');

      expect(repo.create).toHaveBeenCalledWith({
        name: dto.name,
        body: dto.body,
        isDefault: false,
        ownerId: 'owner-1',
      });
      expect(repo.save).toHaveBeenCalledWith(built);
      expect(result).toEqual({ id: 't1', ...built });
    });

    it('respects an explicit isDefault flag', async () => {
      repo.create.mockImplementation((v) => v as FeedbackTemplate);
      repo.save.mockImplementation(async (v) => v as FeedbackTemplate);

      await service.create({ name: 'n', body: 'b', isDefault: true });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isDefault: true }));
    });
  });

  describe('findOne', () => {
    it('returns the template when found', async () => {
      const tpl = { id: 't1' } as FeedbackTemplate;
      repo.findOne.mockResolvedValue(tpl);

      await expect(service.findOne('t1')).resolves.toBe(tpl);
    });

    it('throws NotFoundException when missing', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('paginates and scopes by owner when provided', async () => {
      const templates = [{ id: 't1' }] as FeedbackTemplate[];
      repo.findAndCount.mockResolvedValue([templates, 1]);

      const result = await service.findAll('owner-1', 1, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: 'owner-1' },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result.data).toBe(templates);
      expect(result.totalPages).toBe(1);
    });

    it('does not scope by owner when omitted', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll();

      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('findDefault', () => {
    it('queries for the default template scoped to the owner', async () => {
      const tpl = { id: 't1', isDefault: true } as FeedbackTemplate;
      repo.findOne.mockResolvedValue(tpl);

      const result = await service.findDefault('owner-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { isDefault: true, ownerId: 'owner-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(tpl);
    });

    it('returns null when no default exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findDefault()).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('applies only the provided fields and saves', async () => {
      const tpl = { id: 't1', name: 'old', body: 'old body', isDefault: false } as FeedbackTemplate;
      repo.findOne.mockResolvedValue(tpl);
      repo.save.mockImplementation(async (v) => v as FeedbackTemplate);

      const result = await service.update('t1', { name: 'new' });

      expect(result.name).toBe('new');
      expect(result.body).toBe('old body');
      expect(repo.save).toHaveBeenCalledWith(tpl);
    });

    it('throws NotFoundException when the template does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not the owner', async () => {
      const tpl = { id: 't1', ownerId: 'owner-1' } as FeedbackTemplate;
      repo.findOne.mockResolvedValue(tpl);

      await expect(service.update('t1', { name: 'x' }, 'someone-else')).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows the owner to update their own template', async () => {
      const tpl = { id: 't1', ownerId: 'owner-1', name: 'old' } as FeedbackTemplate;
      repo.findOne.mockResolvedValue(tpl);
      repo.save.mockImplementation(async (v) => v as FeedbackTemplate);

      await expect(service.update('t1', { name: 'new' }, 'owner-1')).resolves.toEqual(
        expect.objectContaining({ name: 'new' }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes the template', async () => {
      const tpl = { id: 't1' } as FeedbackTemplate;
      repo.findOne.mockResolvedValue(tpl);

      await service.remove('t1');

      expect(repo.softDelete).toHaveBeenCalledWith('t1');
    });

    it('throws ForbiddenException when requester is not the owner', async () => {
      const tpl = { id: 't1', ownerId: 'owner-1' } as FeedbackTemplate;
      repo.findOne.mockResolvedValue(tpl);

      await expect(service.remove('t1', 'someone-else')).rejects.toThrow(ForbiddenException);
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the template does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('render', () => {
    const baseCtx = { score: 8, maxScore: 10 };

    it('substitutes score, maxScore, and percentage', () => {
      const result = service.render('{{score}}/{{maxScore}} = {{percentage}}', baseCtx);
      expect(result).toBe('8/10 = 80%');
    });

    it('derives the verdict bucket from percentage thresholds', () => {
      expect(service.render('{{verdict}}', { score: 9, maxScore: 10 })).toBe('Excellent');
      expect(service.render('{{verdict}}', { score: 5, maxScore: 10 })).toBe('Good');
      expect(service.render('{{verdict}}', { score: 1, maxScore: 10 })).toBe('Needs work');
    });

    it('treats a zero or negative maxScore as 0% rather than dividing by zero', () => {
      const result = service.render('{{percentage}}', { score: 5, maxScore: 0 });
      expect(result).toBe('0%');
    });

    it('renders the rubric name and per-criterion points/levels', () => {
      const ctx = {
        score: 8,
        maxScore: 10,
        rubric: {
          name: 'Essay Rubric',
          criteria: [
            {
              id: 'c1',
              title: 'Clarity',
              awardedPoints: 4,
              selectedLevel: { label: 'Strong' },
            },
          ],
        },
      };

      const result = service.render(
        '{{rubric}}: {{criterion.Clarity}} pts ({{level.clarity}})',
        ctx,
      );
      expect(result).toBe('Essay Rubric: 4 pts (Strong)');
    });

    it('accepts a raw template string as well as a FeedbackTemplate entity', () => {
      expect(service.render('plain: {{score}}', baseCtx)).toBe('plain: 8');
      expect(service.render({ body: 'entity: {{score}}' } as FeedbackTemplate, baseCtx)).toBe(
        'entity: 8',
      );
    });

    it('renders unknown placeholders and missing criteria as an empty string', () => {
      expect(service.render('{{unknown}}', baseCtx)).toBe('');
      expect(service.render('{{criterion.Missing}}', baseCtx)).toBe('');
      expect(service.render('{{level.Missing}}', baseCtx)).toBe('');
    });
  });
});
