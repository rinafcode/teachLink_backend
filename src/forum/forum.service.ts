import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumThread } from './entities/forum-thread.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumVote } from './entities/forum-vote.entity';
import { AutoModerationService } from '../moderation/auto/auto-moderation.service';
import { ManualReviewService } from '../moderation/manual/manual-review.service';

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
    const analysis = await this.autoModService.analyze(title + ' ' + content);
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
      await this.manualReviewService.enqueue(
        title + '\n' + content, 
        analysis.score, 
        { sourceType: 'forum_thread', sourceId: saved.id }
      );
    }
    
    return saved;
  }

  async getThreads(): Promise<ForumThread[]> {
    return this.threadRepo.find({ where: { status: 'active' }, order: { createdAt: 'DESC' } });
  }

  async getThread(id: string): Promise<ForumThread> {
    const thread = await this.threadRepo.findOne({ where: { id, status: 'active' }, relations: ['comments'] });
    if (!thread) throw new NotFoundException('Thread not found');
    return thread;
  }

  async addComment(threadId: string, content: string, authorId: string, parentId?: string): Promise<ForumComment> {
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
      await this.manualReviewService.enqueue(
        content,
        analysis.score,
        { sourceType: 'forum_comment', sourceId: saved.id }
      );
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
