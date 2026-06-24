import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cohort } from './entities/cohort.entity';
import { CohortMember } from './entities/cohort-member.entity';
import { CohortThread } from './entities/cohort-thread.entity';
import { CohortComment } from './entities/cohort-comment.entity';
import { CohortAssignment, CohortAssignmentStatus } from './entities/cohort-assignment.entity';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { AddCohortMemberDto } from './dto/add-cohort-member.dto';
import { CreateCohortThreadDto } from './dto/create-cohort-thread.dto';
import { CreateCohortCommentDto } from './dto/create-cohort-comment.dto';
import { CreateCohortAssignmentDto } from './dto/create-cohort-assignment.dto';

@Injectable()
export class CohortsService {
  constructor(
    @InjectRepository(Cohort)
    private readonly cohortRepo: Repository<Cohort>,
    @InjectRepository(CohortMember)
    private readonly memberRepo: Repository<CohortMember>,
    @InjectRepository(CohortThread)
    private readonly threadRepo: Repository<CohortThread>,
    @InjectRepository(CohortComment)
    private readonly commentRepo: Repository<CohortComment>,
    @InjectRepository(CohortAssignment)
    private readonly assignmentRepo: Repository<CohortAssignment>,
  ) {}

  async createCohort(dto: CreateCohortDto, ownerId: string): Promise<Cohort> {
    const cohort = this.cohortRepo.create({
      name: dto.name,
      description: dto.description,
      ownerId,
    });

    const saved = await this.cohortRepo.save(cohort);
    const ownerMembership = this.memberRepo.create({
      cohortId: saved.id,
      userId: ownerId,
      role: 'owner',
    });

    await this.memberRepo.save(ownerMembership);
    return saved;
  }

  async getCohorts(userId: string): Promise<Cohort[]> {
    return this.cohortRepo
      .createQueryBuilder('cohort')
      .innerJoin('cohort.members', 'member', 'member.userId = :userId', { userId })
      .orderBy('cohort.createdAt', 'DESC')
      .getMany();
  }

  async getCohort(cohortId: string, userId: string): Promise<Cohort> {
    const cohort = await this.getAccessibleCohort(cohortId, userId);
    return cohort;
  }

  async addMember(
    cohortId: string,
    actorId: string,
    dto: AddCohortMemberDto,
  ): Promise<CohortMember> {
    const cohort = await this.requireOwner(cohortId, actorId);

    const existing = await this.memberRepo.findOne({
      where: { cohortId, userId: dto.userId },
    });

    if (existing) {
      if (dto.role && existing.role !== dto.role) {
        existing.role = dto.role;
        return this.memberRepo.save(existing);
      }
      return existing;
    }

    const membership = this.memberRepo.create({
      cohortId: cohort.id,
      userId: dto.userId,
      role: dto.role ?? 'member',
    });
    return this.memberRepo.save(membership);
  }

  async removeMember(cohortId: string, actorId: string, userId: string): Promise<void> {
    const cohort = await this.requireOwner(cohortId, actorId);
    if (cohort.ownerId === userId) {
      throw new BadRequestException('Cohort owner cannot be removed');
    }

    const membership = await this.memberRepo.findOne({
      where: { cohortId, userId },
    });
    if (!membership) {
      throw new NotFoundException('Cohort member not found');
    }

    await this.memberRepo.remove(membership);
  }

  async listMembers(cohortId: string, userId: string): Promise<CohortMember[]> {
    await this.requireMembership(cohortId, userId);
    return this.memberRepo.find({ where: { cohortId }, order: { createdAt: 'ASC' } });
  }

  async createThread(
    cohortId: string,
    authorId: string,
    dto: CreateCohortThreadDto,
  ): Promise<CohortThread> {
    await this.requireMembership(cohortId, authorId);

    const thread = this.threadRepo.create({
      cohortId,
      authorId,
      title: dto.title,
      content: dto.content,
    });
    return this.threadRepo.save(thread);
  }

  async listThreads(cohortId: string, userId: string): Promise<CohortThread[]> {
    await this.requireMembership(cohortId, userId);
    return this.threadRepo.find({
      where: { cohortId },
      order: { createdAt: 'DESC' },
    });
  }

  async getThread(threadId: string, userId: string): Promise<CohortThread> {
    const thread = await this.threadRepo.findOne({
      where: { id: threadId },
      relations: ['comments'],
      order: { comments: { createdAt: 'ASC' } },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    await this.requireMembership(thread.cohortId, userId);
    return thread;
  }

  async addComment(
    threadId: string,
    authorId: string,
    dto: CreateCohortCommentDto,
  ): Promise<CohortComment> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    await this.requireMembership(thread.cohortId, authorId);

    const comment = this.commentRepo.create({
      threadId,
      authorId,
      content: dto.content,
      parentId: dto.parentId,
    });
    return this.commentRepo.save(comment);
  }

  async createAssignment(
    cohortId: string,
    actorId: string,
    dto: CreateCohortAssignmentDto,
  ): Promise<CohortAssignment> {
    await this.requireOwner(cohortId, actorId);

    const assignment = this.assignmentRepo.create({
      cohortId,
      title: dto.title,
      description: dto.description,
      dueDate: dto.dueDate,
      status: CohortAssignmentStatus.OPEN,
    });

    return this.assignmentRepo.save(assignment);
  }

  async listAssignments(cohortId: string, userId: string): Promise<CohortAssignment[]> {
    await this.requireMembership(cohortId, userId);
    return this.assignmentRepo.find({ where: { cohortId }, order: { createdAt: 'DESC' } });
  }

  async getAssignment(cohortId: string, assignmentId: string, userId: string): Promise<CohortAssignment> {
    await this.requireMembership(cohortId, userId);
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId, cohortId } });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  private async requireOwner(cohortId: string, userId: string): Promise<Cohort> {
    const cohort = await this.cohortRepo.findOne({ where: { id: cohortId } });
    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    if (cohort.ownerId !== userId) {
      throw new ForbiddenException('Only cohort owner can manage this resource');
    }

    return cohort;
  }

  private async requireMembership(cohortId: string, userId: string): Promise<CohortMember> {
    const membership = await this.memberRepo.findOne({
      where: { cohortId, userId },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }
    return membership;
  }

  private async getAccessibleCohort(cohortId: string, userId: string): Promise<Cohort> {
    const cohort = await this.cohortRepo
      .createQueryBuilder('cohort')
      .innerJoin('cohort.members', 'member', 'member.userId = :userId', { userId })
      .where('cohort.id = :cohortId', { cohortId })
      .getOne();

    if (!cohort) {
      throw new NotFoundException('Cohort not found or access denied');
    }

    return cohort;
  }
}
