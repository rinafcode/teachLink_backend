import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CohortsService } from './cohorts.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { AddCohortMemberDto } from './dto/add-cohort-member.dto';
import { CreateCohortThreadDto } from './dto/create-cohort-thread.dto';
import { CreateCohortCommentDto } from './dto/create-cohort-comment.dto';
import { CreateCohortAssignmentDto } from './dto/create-cohort-assignment.dto';

@ApiTags('Cohorts')
@Controller('cohorts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CohortsController {
  constructor(private readonly cohortsService: CohortsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new cohort for collaborative learning' })
  @ApiResponse({ status: 201, description: 'Cohort created successfully' })
  createCohort(@Body() dto: CreateCohortDto, @Req() req: any) {
    return this.cohortsService.createCohort(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List cohorts the authenticated user belongs to' })
  getCohorts(@Req() req: any) {
    return this.cohortsService.getCohorts(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cohort details' })
  getCohort(@Param('id') id: string, @Req() req: any) {
    return this.cohortsService.getCohort(id, req.user.id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to a cohort' })
  addCohortMember(
    @Param('id') id: string,
    @Body() dto: AddCohortMemberDto,
    @Req() req: any,
  ) {
    return this.cohortsService.addMember(id, req.user.id, dto);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from a cohort' })
  removeCohortMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.cohortsService.removeMember(id, req.user.id, memberId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List cohort members' })
  listMembers(@Param('id') id: string, @Req() req: any) {
    return this.cohortsService.listMembers(id, req.user.id);
  }

  @Post(':id/threads')
  @ApiOperation({ summary: 'Create a discussion thread inside a cohort' })
  createThread(
    @Param('id') id: string,
    @Body() dto: CreateCohortThreadDto,
    @Req() req: any,
  ) {
    return this.cohortsService.createThread(id, req.user.id, dto);
  }

  @Get(':id/threads')
  @ApiOperation({ summary: 'List discussion threads inside a cohort' })
  getThreads(@Param('id') id: string, @Req() req: any) {
    return this.cohortsService.listThreads(id, req.user.id);
  }

  @Get(':id/threads/:threadId')
  @ApiOperation({ summary: 'Get a cohort discussion thread with comments' })
  getThread(@Param('threadId') threadId: string, @Req() req: any) {
    return this.cohortsService.getThread(threadId, req.user.id);
  }

  @Post('threads/:threadId/comments')
  @ApiOperation({ summary: 'Add a comment to a cohort discussion thread' })
  addComment(
    @Param('threadId') threadId: string,
    @Body() dto: CreateCohortCommentDto,
    @Req() req: any,
  ) {
    return this.cohortsService.addComment(threadId, req.user.id, dto);
  }

  @Post(':id/assignments')
  @ApiOperation({ summary: 'Create an assignment for a cohort' })
  createAssignment(
    @Param('id') id: string,
    @Body() dto: CreateCohortAssignmentDto,
    @Req() req: any,
  ) {
    return this.cohortsService.createAssignment(id, req.user.id, dto);
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'List assignments for a cohort' })
  getAssignments(@Param('id') id: string, @Req() req: any) {
    return this.cohortsService.listAssignments(id, req.user.id);
  }

  @Get(':id/assignments/:assignmentId')
  @ApiOperation({ summary: 'Get assignment details for a cohort' })
  getAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Req() req: any,
  ) {
    return this.cohortsService.getAssignment(id, assignmentId, req.user.id);
  }
}
