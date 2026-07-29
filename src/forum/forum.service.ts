import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumThread } from './entities/forum-thread.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumVote } from './entities/forum-vote.entity';
import { AutoModerationService } from '../moderation/auto/auto-moderation.service';
import { ManualReviewService } from '../moderation/manual/manual-review.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { OffsetPaginatedResponse } from '../common/interfaces/pagination.interface';
import { buildOffsetResponse, clampLimit } from '../common/utils/pagination.utils';

export type ForumThreadListItem = Pick<
  ForumThread,
  'id' | 'title' | 'authorId' | 'createdAt' | 'upvotes' | 'downvotes'
>;

export type ForumThreadDetail = Omit<ForumThread, 'comments'> & {
  comments: OffsetPaginatedResponse<ForumComment>;
};

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(ForumThread)
    private readonly threadRepo: Repository<ForumThread>,
    @InjectRepository(ForumComment)
    private readonly commentRepo: Repository<ForumComment>,
    @InjectRepository(ForumVote)
    private readonly voteRepo: Repository<ForumVote>,
    private readonly autoModService: AutoModerationService,
    private readonly manualReviewService: ManualReviewService,
  ) {}

  async createThread(title: string, content: string, authorId: string): Promise<ForumThread> {
    const analysis = await this.autoModService.analyze(`${title} ${content}`);
    let status = 'active';

    if (analysis.flagged) {
      status = 'flagged';
    }

    const thread = this.threadRepo.create({
      title,
      content,
      authorId,
      status,
    });

    const saved = await this.threadRepo.save(thread);

    if (analysis.flagged) {
      await this.manualReviewService.enqueue(`${title}\n${content}`, analysis.score, {
        sourceType: 'forum_thread',
        sourceId: saved.id,
      });
    }

    return saved;
  }

  async getThreads(
    query?: PaginationQueryDto,
  ): Promise<OffsetPaginatedResponse<ForumThreadListItem>> {
    const limit = clampLimit(query?.limit);
    const offset = query?.offset;
    const page = offset !== undefined ? Math.floor(offset / limit) + 1 : (query?.page ?? 1);
    const skip = offset !== undefined ? offset : (page - 1) * limit;

    const qb = this.threadRepo
      .createQueryBuilder('thread')
      .select([
        'thread.id',
        'thread.title',
        'thread.authorId',
        'thread.createdAt',
        'thread.upvotes',
        'thread.downvotes',
      ])
      .where('thread.status = :status', { status: 'active' })
      .orderBy('thread.createdAt', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return buildOffsetResponse(data, total, page, limit);
  }

  async getThread(id: string, query?: PaginationQueryDto): Promise<ForumThreadDetail> {
    const thread = await this.threadRepo.findOne({
      where: { id, status: 'active' },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    const limit = clampLimit(query?.limit);
    const offset = query?.offset;
    const page = offset !== undefined ? Math.floor(offset / limit) + 1 : (query?.page ?? 1);
    const skip = offset !== undefined ? offset : (page - 1) * limit;

    const [comments, total] = await this.commentRepo.findAndCount({
      where: { threadId: id, status: 'active' },
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return {
      ...thread,
      comments: buildOffsetResponse(comments, total, page, limit),
    };
  }

  async addComment(
    threadId: string,
    content: string,
    authorId: string,
    parentId?: string,
  ): Promise<ForumComment> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId, status: 'active' } });
    if (!thread) throw new NotFoundException('Thread not found');

    const analysis = await this.autoModService.analyze(content);
    let status = 'active';
    if (analysis.flagged) {
      status = 'flagged';
    }

    const comment = this.commentRepo.create({
      threadId,
      content,
      authorId,
      parentId,
      status,
    });

    const saved = await this.commentRepo.save(comment);

    if (analysis.flagged) {
      await this.manualReviewService.enqueue(content, analysis.score, {
        sourceType: 'forum_comment',
        sourceId: saved.id,
      });
    }

    return saved;
  }

  async vote(entityType: 'thread' | 'comment', entityId: string, authorId: string, value: number) {
    if (value !== 1 && value !== -1) throw new BadRequestException('Vote value must be 1 or -1');

    const existing = await this.voteRepo.findOne({ where: { entityType, entityId, authorId } });
    if (existing) {
      if (existing.value === value) {
        return;
      }

      existing.value = value;
      await this.voteRepo.save(existing);

      await this.updateVoteTotals(entityType, entityId);
      return;
    }

    const vote = this.voteRepo.create({ entityType, entityId, authorId, value });
    await this.voteRepo.save(vote);
    await this.updateVoteTotals(entityType, entityId);
  }

  private async updateVoteTotals(entityType: 'thread' | 'comment', entityId: string) {
    const upvotes = await this.voteRepo.count({ where: { entityType, entityId, value: 1 } });
    const downvotes = await this.voteRepo.count({ where: { entityType, entityId, value: -1 } });

    if (entityType === 'thread') {
      await this.threadRepo.update(entityId, { upvotes, downvotes });
    } else {
      await this.commentRepo.update(entityId, { upvotes, downvotes });
    }
  }
}
