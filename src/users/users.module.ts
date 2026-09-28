import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserActivityController } from './controllers/user-activity.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

/**
 * Users module to handle user-specific operations.
 * Currently focuses on user search, activity timeline, and history.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), AuditLogModule],
  controllers: [UserActivityController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
