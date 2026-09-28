import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProfileCompletenessController } from './profile-completeness.controller';
import { ProfileCompletenessService } from './profile-completeness.service';
import { User } from '../users/entities/user.entity';
import { THROTTLE } from '../common/constants/throttle.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ThrottlerModule.forRoot([{ ttl: THROTTLE.MODERATE.ttl, limit: THROTTLE.MODERATE.limit }]),
  ],
  controllers: [ProfileCompletenessController],
  providers: [ProfileCompletenessService],
  exports: [ProfileCompletenessService],
})
export class ProfileCompletenessModule {}
