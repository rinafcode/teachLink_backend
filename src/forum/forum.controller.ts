import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ForumService } from './forum.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Forum')
@Controller('forums')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Post('threads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Authentication required' })
  createThread(
    @Body() body: { title: string; content: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.forumService.createThread(body.title, body.content, user.id);
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Authentication required' })
  addComment(
    @Param('id') threadId: string,
    @Body() body: { content: string; parentId?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.forumService.addComment(threadId, body.content, user.id, body.parentId);
  }

  @Post('threads/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Authentication required' })
  voteThread(
    @Param('id') id: string,
    @Body() body: { value: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.forumService.vote('thread', id, user.id, body.value);
  }

  @Post('comments/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Authentication required' })
  voteComment(
    @Param('id') id: string,
    @Body() body: { value: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.forumService.vote('comment', id, user.id, body.value);
  }
}
