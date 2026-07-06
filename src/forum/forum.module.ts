import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumThread } from './entities/forum-thread.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumVote } from './entities/forum-vote.entity';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [TypeOrmModule.forFeature([ForumThread, ForumComment, ForumVote]), ModerationModule],
  controllers: [ForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}
