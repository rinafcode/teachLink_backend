import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CohortsController } from './cohorts.controller';
import { CohortsService } from './cohorts.service';
import { Cohort } from './entities/cohort.entity';
import { CohortMember } from './entities/cohort-member.entity';
import { CohortThread } from './entities/cohort-thread.entity';
import { CohortComment } from './entities/cohort-comment.entity';
import { CohortAssignment } from './entities/cohort-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cohort,
      CohortMember,
      CohortThread,
      CohortComment,
      CohortAssignment,
    ]),
  ],
  controllers: [CohortsController],
  providers: [CohortsService],
  exports: [CohortsService],
})
export class CohortsModule {}
