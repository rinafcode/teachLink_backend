import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileCompletenessController } from './profile-completeness.controller';
import { ProfileCompletenessService } from './profile-completeness.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [ProfileCompletenessController],
  providers: [ProfileCompletenessService],
  exports: [ProfileCompletenessService],
})
export class ProfileCompletenessModule {}
