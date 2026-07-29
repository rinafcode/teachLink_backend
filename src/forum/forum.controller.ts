import { Controller, Post, Get, Body, Param, Req, Query } from '@nestjs/common';
import { ForumService } from './forum.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@Controller('forums')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Post('threads')
  createThread(@Body() body: { title: string; content: string }, @Req() req: any) {
    const authorId = req.user?.id || 'anonymous';
    return this.forumService.createThread(body.title, body.content, authorId);
  }

  @Get('threads')
  getThreads(@Query() query?: PaginationQueryDto) {
    return this.forumService.getThreads(query);
  }

  @Get('threads/:id')
  getThread(@Param('id') id: string, @Query() query?: PaginationQueryDto) {
    return this.forumService.getThread(id, query);
  }

  @Post('threads/:id/comments')
  addComment(
    @Param('id') threadId: string,
    @Body() body: { content: string; parentId?: string },
    @Req() req: any,
  ) {
    const authorId = req.user?.id || 'anonymous';
    return this.forumService.addComment(threadId, body.content, authorId, body.parentId);
  }

  @Post('threads/:id/vote')
  voteThread(@Param('id') id: string, @Body() body: { value: number }, @Req() req: any) {
    const authorId = req.user?.id || 'anonymous';
    return this.forumService.vote('thread', id, authorId, body.value);
  }

  @Post('comments/:id/vote')
  voteComment(@Param('id') id: string, @Body() body: { value: number }, @Req() req: any) {
    const authorId = req.user?.id || 'anonymous';
    return this.forumService.vote('comment', id, authorId, body.value);
  }
}
